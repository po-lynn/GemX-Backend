# Scale Fine-Tuning: Cache Lifetimes, Product Search Indexes, Points Ledger Atomicity

Follow-up to a Next.js 16.3 cache-conformance review and a scalability review
(product/user tables, points transactions, connection pool, cache handler)
done against the actual production database and the Next 16 docs shipped in
`node_modules/next/dist/docs/`. Three independent fixes, described together
because they came out of the same review pass.

## 1. Explicit `cacheLife` on every `"use cache"` reader

**Files:** `features/{laboratory,origin,rating-tags,precaution-tags,app-content}/db/cache/*.ts`,
`features/rbac/db/permissions.ts`, `features/products/db/cache/products.ts`.

**What changed:** every cached function that previously omitted `cacheLife()`
now calls `cacheLife("max")` (30-day revalidate / 1-year expire). Per the Next
16.3 `cacheLife` docs, omitting it silently falls back to the `default`
profile (15-minute revalidate) and "makes it harder to reason about" cache
behavior at the call site. All of these entries are already invalidated
on-demand via `cacheTag()` + `revalidateTag(tag, "max")`/`updateTag(tag)` on
every mutation (see each module's `revalidate*Cache()` export), so `"max"` is
safe: correctness comes from tag invalidation, not from the time-based
window expiring.

**Why this matters less in production than it looks on paper:** this app
deploys to Vercel (serverless, per `vercel.json`/`README.md`) with no
`cacheHandlers` configured in `next.config.ts` and no Redis/Upstash
dependency. Per the Next 16 `use cache` docs' "Runtime caching
considerations" section, the default in-memory LRU cache handler does **not**
persist across requests on serverless — each invocation can be a different,
ephemeral instance. Combined with every route still carrying
`export const instant = false` (fully dynamic, not prerendered), this
`cacheLife` tuning mostly helps within a single warm instance, not across the
fleet. Getting the full benefit at real traffic scale would need
`"use cache: remote"` backed by Redis/Upstash, or moving routes toward actual
Cache Components prerendering.

## 2. Product search & sort indexes

**Files:** `drizzle/schema/product-schema.ts`,
`drizzle/migrations/0088_zippy_scalphunter.sql`,
`drizzle/migrations/0089_product_search_indexes.sql`.

**What changed:**
- Added `product_createdAt_idx` (btree on `product.created_at`). Nearly every
  listing query (`features/products/db/products.ts`) defaults to
  `orderBy(desc(createdAt))`; without an index, that sort requires a full
  sort at table scale instead of an index-ordered scan.
- Promoted `scripts/postgres-fulltext-search.sql` into the tracked Drizzle
  migration pipeline. **That script had never actually been run against the
  production database** — verified directly via `psql "$DATABASE_URL" -c
  "select indexname from pg_indexes where tablename='product'"` before this
  change, which showed no FTS index and no `pg_trgm` extension installed.
  It was a standalone "run once in the Supabase SQL editor" script with no
  guarantee it ran anywhere.
- Added `pg_trgm` + trigram GIN indexes on `product.title`, `user.name`,
  `user.phone`, `user.email`, in addition to the `to_tsvector`/GIN full-text
  index on `product(title, description)`.

**Why the trigram indexes were necessary, not optional:** the product search
condition (`features/products/db/products.ts`, `getAdminProductsFromDb` and
its duplicates) is a single `OR` of five clauses: the full-text match plus
four `ilike('%term%')` clauses on `product.title`, `user.name`, `user.phone`,
`user.email`. Postgres generally cannot use an index scan for an `OR`
condition when *any* disjunct lacks a supporting index — it falls back to a
sequential scan for the whole condition. Adding only the FTS index (as the
original script did) would not have helped real searches at scale, because
the four `ilike` branches had no index at all. All five branches now have
one.

**Verified, not assumed:** after migrating,
`select indexname from pg_indexes where tablename in ('product','user')`
confirms `product_createdAt_idx`, `product_title_description_fts_idx`,
`product_title_trgm_idx`, `user_name_trgm_idx`, `user_phone_trgm_idx`,
`user_email_trgm_idx`, and `pg_trgm` all exist on the live database. An
`EXPLAIN` on the search query at current table size (~40 rows) correctly
shows a sequential scan — the planner's cost model prefers it at this size;
the indexes are ready for when the table grows past that threshold, not
expected to be used yet.

**Not changed:** pagination stays `OFFSET`-based
(`features/products/db/products.ts`, `features/points/db/points.ts`). Fine
for the current shallow admin pages; would need cursor-based pagination if
any public/high-traffic listing ever paginates deep.

## 3. Points ledger: atomic credit + ledger write

**Files:** `features/points/db/points.ts`, `features/points/db/monthly-bonus.ts`.

**Bug:** `creditUserPoints()` (balance update) and `logPointTransaction()`
(ledger insert) were called as two separate, non-transactional statements in
three places: `applyDefaultPointsToNewUser`,
`creditDefaultRegistrationPointsToUser`, and the per-user grant loop in
`grantDueMonthlyBonusPoints` (monthly-bonus.ts).

For the two registration-bonus call sites this was an audit-trail gap: a
crash between the two calls leaves the balance bumped with no ledger row,
but doesn't double-credit anything since nothing re-reads that ledger row to
decide eligibility.

For the monthly-bonus batch loop, the same gap was a real **double-credit
risk at scale**: `usersAlreadyGranted()` (monthly-bonus.ts) treats a
`completed` `pointTransaction` row with the cycle's `referenceId` as the sole
proof a user was already paid for that cycle. A crash mid-batch (serverless
timeout, deploy, OOM — all plausible when looping over a large eligible-user
set) between `creditUserPoints` succeeding and `logPointTransaction` running
leaves that user credited with no ledger row. The next cron run's
`usersAlreadyGranted()` wouldn't see them as paid, `listEligibleUserIdsExcluding`
would include them again, and they'd be credited a second time for the same
cycle.

**Fix:** `creditUserPoints()` and `logPointTransaction()` now take an
optional third/second `dbOrTx` client argument (defaults to the top-level
`db`, typed `PgClient = typeof db | Parameters<Parameters<typeof
db.transaction>[0]>[0]`). All three call sites now wrap their credit + ledger
write in `db.transaction(async (tx) => { ... })`, passing `tx` through —
matching the existing pattern already used by `approvePointPurchaseRequest`
and `setUserPermissions`-style flows elsewhere in this codebase. If the
process dies mid-transaction, Postgres rolls back the balance change too, so
`usersAlreadyGranted()` correctly sees the user as still pending.

## Data flow (points ledger fix)

```
grantDueMonthlyBonusPoints (monthly-bonus.ts)
  → per eligible user, per pending cycle:
      db.transaction(tx =>
        creditUserPoints(userId, amount, tx)   -- UPDATE user SET points = points + amount
          → logPointTransaction({...}, tx)     -- INSERT pointTransaction (referenceId = cycle)
      )
  → next cron run: usersAlreadyGranted(referenceId) only sees users whose
    ledger row actually committed — no partial-credit state is possible.
```

## Schema impact

- `product` table: added `product_createdAt_idx` (btree), the FTS GIN index,
  and a trigram GIN index on `title`. See migrations `0088_zippy_scalphunter.sql`
  and `0089_product_search_indexes.sql`.
- `user` table: added trigram GIN indexes on `name`, `phone`, `email` (same
  `0089` migration). No column changes.
- `pg_trgm` extension enabled on the database.
- No changes to `point_transaction` or `user.points`/`pointsLifetime` column
  shapes — the points fix is purely transactional wrapping around existing
  writes.

## Auth & permissions

Unchanged in all three fixes — no access-control logic touched.

## Known gaps / limitations

- The runtime `use cache` benefit described in §1 is capped by the
  serverless/no-Redis deployment shape, not by anything in this change;
  fixing that fully is a separate, bigger decision (add `cacheHandlers`/
  Redis, or adopt per-route Cache Components prerendering).
- §2 doesn't address `OFFSET`-based pagination depth cost — only search and
  default-sort cost.
- §3 doesn't add a `db.transaction` wrapper for the *approval* flows
  (`approvePointPurchaseRequest`, `overrideApprovePointPurchaseRequest`) —
  those were already correct before this change.
