# Reviews & Seller Reputation admin area — Phase 1

Design spec: `docs/superpowers/specs/2026-08-04-reviews-admin-phase1-design.md` (data model,
rule definitions, and the "Explicit non-goals for phase 1" section — link there for scope
boundaries rather than duplicating them here).

## What changed

Phase 1 adds a new "Trust & Reputation" admin area: a shared data model for seller
reputation signals, RBAC wiring, a sidebar section with 6 routes, and a full build of one
of those six views — **Reputation Cases** (`/admin/reviews/cases`). The other five routes
are placeholder "coming in a later phase" pages so the sidebar has no dead links.

Files touched (grouped by task):

- **Schema** — `drizzle/schema/reputation-schema.ts` (new): `reputation_threshold`,
  `seller_reputation_action`, `seller_archive`. Migration `drizzle/migrations/0071_married_maverick.sql`.
- **RBAC** — `features/rbac/feature-keys.ts`: added `FEATURE_KEYS.REVIEWS = "reviews"`.
- **DB layers** — `features/reviews/db/reputation-thresholds.ts` (threshold config +
  idempotent seeding), `features/reviews/db/reputation-cases.ts` (live case computation),
  `features/reviews/db/reputation-actions.ts` (archive/dismiss/secondary-action mutations).
- **Validation** — `features/reviews/schemas/reputation-actions.ts` (Zod schemas for every
  mutation).
- **Server actions** — `features/reviews/actions/reputation-cases.ts`.
- **API route** — `app/api/admin/reviews/badge-counts/route.ts` (sidebar badge counts).
- **UI** — `components/admin/AdminSidebar.tsx` (new "Trust & Reputation" nav group),
  `features/reviews/hooks/use-reviews-badge-counts.ts`, `app/admin/reviews/cases/page.tsx`,
  `features/reviews/components/ReputationCasesTable.tsx`,
  `features/reviews/components/ReputationCaseDrawer.tsx`,
  `features/reviews/components/ComingSoonView.tsx` (used by the 5 placeholder pages:
  `app/admin/reviews/{page,sellers,archived,thresholds,audit}/page.tsx`).

Why: GEMX does not moderate individual buyer reviews (they publish immediately) — the gap
this fills is oversight of seller reputation *trends* across reviews, so staff can work
cases and archive sellers whose reputation falls below policy. See the design spec's
"Context" section for the full six-view roadmap; only Reputation Cases is built end-to-end
in phase 1.

## Data flow

```
seller_rating (+ rating_tag_map/rating_tags)
        │
        ▼
computeCaseSummaries()            features/reviews/db/reputation-cases.ts
  ├─ getEnabledThresholdIds()  ──► features/reviews/db/reputation-thresholds.ts
  │                                (reads reputation_threshold, seeds it on first read)
  ├─ 4 rule matcher queries        (rating_below_archive, negative_streak,
  │                                 tag_concentration, positive_burst)
  ├─ dismissal suppression    ──► seller_reputation_action (actionType = 'dismissed')
  └─ archive exclusion        ──► seller_archive (restoredAt IS NULL)
        │
        ▼
getOpenReputationCases(tab, page, limit) / getReputationCaseCounts() / getReputationBadgeCounts()
        │
        ├─► app/admin/reviews/cases/page.tsx (Server Component)
        │       └─► ReputationCasesTable (client) ──► ReputationCaseDrawer (detail panel)
        │               │
        │               └─ row/bulk actions ──► features/reviews/actions/reputation-cases.ts
        │                                          (server actions) ──► reputation-actions.ts
        │                                          (DB writes to seller_archive /
        │                                           seller_reputation_action)
        │
        └─► GET /api/admin/reviews/badge-counts ──► useReviewsBadgeCounts() (client hook)
                                                       ──► AdminSidebar.tsx badge counts
```

There are **no persisted "open case" rows** — every case is computed live on each page
load / API call from `seller_rating` plus the audit/archive tables. This keeps the sidebar
badge, the page header count, the tab counts, and the pager total from ever desyncing:
they all derive from the same `computeCaseSummaries()` call (see design spec, "Case
computation").

## Schema impact

Three new tables added via migration `0071_married_maverick.sql` (no existing tables
altered):

| Table | Purpose | Key columns |
|---|---|---|
| `reputation_threshold` | Config for the 6 rules from the README, one row per rule | `id` (text PK, stable key e.g. `rating_below_archive`), `enabled`, `sortOrder`, `dataAvailable` |
| `seller_reputation_action` | Append-only audit trail; also the dismissal-suppression record | `sellerUserId` (nullable — null only for a future `threshold_toggled` action), `actionType` (enum), `triggerKey` (nullable FK → `reputation_threshold.id`), `reason`, `adminUserId` (nullable FK → `user`, **ON DELETE SET NULL**) |
| `seller_archive` | Current archive state, one row per seller ever archived | `sellerUserId` (unique FK → `user`), `reason`, `archivedByAdminId` (nullable FK → `user`, **ON DELETE SET NULL**), `appealStatus` (enum, admin-set only), `restoredAt` (null = currently archived) |

### Admin FK cascade fix (post-review)

`adminUserId` and `archivedByAdminId` were originally `NOT NULL` with `ON DELETE CASCADE`.
Deleting an admin user is a real, reachable operation (`features/users/actions/users.ts`), and
the cascade silently destroyed decision history:

- `seller_archive` — the whole archive row vanished, so the `restoredAt IS NULL` exclusion in
  `computeCaseSummaries` stopped applying and the seller reappeared as an open case with no
  record it had ever been archived.
- `seller_reputation_action` — the append-only audit trail was destroyed, including the
  `dismissed` rows that suppress recomputed cases, so dismissed cases reopened too.

Both columns are now nullable with `ON DELETE SET NULL`, matching `restoredByAdminId`. The
write path is unchanged: `writeReputationAction`/`archiveSeller` still require
`adminUserId: string`, so every *new* row carries a real admin; only *historical* rows can
become null once that admin is deleted. Any future UI that renders "archived by {name}" must
handle the null case (nothing reads these columns today — the Archived sellers and Audit log
views are still `ComingSoonView` placeholders).

**Migration not yet generated.** This repo's convention is that the human owner runs
`npm run db:generate` / `npm run db:migrate`; the schema TypeScript is the only thing changed
here. The pending migration must drop both `NOT NULL` constraints and replace both FK actions.

Note: the migration only creates the empty `reputation_threshold` table — its 6 rows are
seeded idempotently at read time by `ensureThresholdsSeeded()` in
`features/reviews/db/reputation-thresholds.ts` (`onConflictDoNothing` on `id`), not via a
migration data-seed step. This matches this repo's existing convention of migrations
containing schema only.

## Auth & permissions

One shared feature key gates all six Reviews views (one cohesive workflow, not six
independent permissions): `FEATURE_KEYS.REVIEWS = "reviews"`
(`features/rbac/feature-keys.ts`).

| Layer | Guard | Behavior |
|---|---|---|
| Pages (`app/admin/reviews/**/page.tsx`) | `requireFeatureAccess(FEATURE_KEYS.REVIEWS)` (`lib/admin-guard.ts`) | Redirects to `/login` if no session, `/admin` if session exists but lacks access. Admin role always passes; `internal` role passes if `checkInternalAccess(userId, "reviews")` is true. |
| Server actions (`features/reviews/actions/reputation-cases.ts`) | `requireReviewsSession()` (local helper, same admin/internal-with-RBAC-key logic) | Returns `{ error: "Unauthorized" }` instead of throwing — client shows this via `toast.error`. |
| Badge-counts API route (`app/api/admin/reviews/badge-counts/route.ts`) | `requireAdminOrFeature(request, FEATURE_KEYS.REVIEWS)` (`lib/api-guard.ts`) | Returns `401`/`403` JSON error responses. |

All three guards share the same admin-or-internal-with-feature-key semantics; they're
implemented three times (page redirect, action error-return, route JSON-error) because
each call site needs a different failure shape, not because the policy differs.

## Known limitations

See the design spec's **"Explicit non-goals for phase 1"** section
(`docs/superpowers/specs/2026-08-04-reviews-admin-phase1-design.md`) for the authoritative
list — summarized: no storefront enforcement of archiving, no background
scheduler/auto-archive execution, no buyer-facing appeal intake, rule 4 (non-delivery
reports) and the device-cluster half of rule 5 are not computable (no data source exists),
GMV/escrow-dispute figures are omitted everywhere, and the 5 secondary case actions
(warn/limit/hide/request-documents/escalate) record intent only with no functional effect.

Additional phase-1-specific notes not already in the design spec:

- **Dev database has zero rows in `seller_rating` as of this writing.** No seller can match
  any rule with an empty table, so `/admin/reviews/cases` correctly renders its "No open
  cases right now" empty state, `getReputationBadgeCounts()` returns `{ openCases: 0,
  archivedSellers: 0 }`, and the sidebar badges don't render (the badge markup in
  `AdminSidebar.tsx` only renders when `openCases > 0` / `archivedSellers > 0`). This was
  confirmed against the actual dev DB before writing this doc — it is expected behavior
  given empty data, not a bug. Browser verification (see Step 6 in the task-12 report) was
  therefore limited to confirming the empty state and sidebar render correctly, not to
  seeing a populated case list or drawer.
- **Rule matcher queries run sequentially, not in parallel**, both within
  `computeCaseSummaries()` (one rule at a time) and in `app/admin/reviews/cases/page.tsx`
  (`getOpenReputationCases` then `getReputationCaseCounts`, not `Promise.all`) — deliberate,
  since these all hit `seller_rating` with aggregate scans and the plan calls for bounding
  concurrent connection-pool usage rather than maximizing per-request parallelism.
- **`computeCaseSummaries()` scopes its dismissal/archive lookups to only the sellers that
  matched at least one rule in that call** (not a full table scan), since
  `seller_reputation_action` has no other bound and grows with every future dismiss action.
- Severity per seller is the **worst matching rule** (rating-below-floor → critical,
  negative-streak → high, tag-concentration → medium, positive-burst → high); a seller
  triggering multiple rules carries every matched signal but is ranked/sorted by the worst
  one only.
- **The "Closed" tab's count and its row list can disagree — by design, not a bug.**
  `filterByTab` in `features/reviews/db/reputation-cases.ts` unconditionally returns `[]`
  for `tab === "closed"` (closed cases aren't part of the live `seller_rating`-derived
  summaries at all), while `getReputationCaseCounts()`'s `closed` figure comes from a
  separate real query over `seller_reputation_action` (`archived`/`dismissed`/`warned`
  rows in the last 90 days), which can be nonzero. So an admin can see a tab labeled
  "Closed (5)" that renders an empty table underneath. This is current, intentional
  phase-1 behavior — the tab's count is real, its row list simply isn't wired to a data
  source yet — but it reads exactly like a rendering bug, so don't "fix" it without
  revisiting the design spec first.

## Whole-branch review fix wave

Fixes applied after the final cross-cutting review of the branch (the FK cascade fix is
documented under **Schema impact** above).

- **`tag_concentration` counted tag instances, not reviews.** `matchTagConcentration` in
  `features/reviews/db/reputation-cases.ts` joins `seller_rating → rating_tag_map →
  rating_tags`, which is many-to-many, so a review carrying N tags emits N rows. `count(*)`
  therefore counted tag-instance rows: it inflated the ratio denominator (suppressing real
  cases) and let a 5-review seller with 2 tags each pass the `>= 10` review-sample gate on
  10 join rows alone. All five counting sites now use `count(DISTINCT sr.id)`. Guarded by a
  query-text assertion in `tests/unit/reputation-cases.test.ts` (the rule is raw SQL run by
  Postgres, so the query text is the only contract a mocked `db` can check).
- **Archive UI claimed enforcement that doesn't exist.** Five strings said archiving hides the
  seller/listings from buyers. `archiveSeller` only writes two rows — phase 1 is record-only
  per the design spec's non-goals. Reworded in `ReputationCaseDrawer.tsx` (decision warning),
  `ReputationCasesTable.tsx` (success toast + confirm dialog), `app/admin/reviews/cases/page.tsx`
  (subhead) and `app/admin/reviews/archived/page.tsx` (placeholder subhead).
- **Severity pill had no CSS.** `ReputationCasesTable` renders `.lv-status.{critical,high,
  medium,watch}` but none of those four selectors existed, so all severities rendered
  identically. Added next to the existing `.lv-status.*` variants in `app/admin-list-view.css`.
- **Pipeline ran twice per page and wrote on every read.** `computeCaseSummaries` (called
  independently by `getOpenReputationCases` and `getReputationCaseCounts` in one render) and
  `ensureThresholdsSeeded` (an INSERT run before every threshold read) are now wrapped in
  React's `cache()` for request-scoped memoization. This does not change behavior — `cache()`
  dedupes only within one request, and outside a React request scope (Vitest) it is a
  pass-through. It also does not fully remove the write-on-read: a new request still issues one
  `INSERT … ON CONFLICT DO NOTHING`. Eliminating that needs a module-level latch or an explicit
  admin seed action, deliberately out of scope. The sidebar badge fetch
  (`useReviewsBadgeCounts`) was intentionally *not* pathname-gated — `AdminSidebar` renders
  everywhere and the badge's whole purpose is panel-wide visibility of an open case.
- **Re-archiving hit an uncaught unique-constraint violation.** `seller_archive` is unique on
  `sellerUserId`, so a double-submit threw from `archiveSeller`'s plain insert and nothing in
  the chain caught it — an unhandled rejection with no user-visible error. `archiveSeller` now
  upserts (`onConflictDoUpdate`, refreshing reason/admin/`archivedAt` and clearing
  `restoredAt`), and all five actions in `features/reviews/actions/reputation-cases.ts` wrap
  their DB mutation in try/catch so any driver throw returns `{ error }` and reaches the
  existing `toast.error` path. The two bulk actions abort on the first failure and report which
  item failed rather than continuing past a DB error.
- **Dismiss only cleared the first of multiple signals.** Suppression is keyed per
  `(seller, rule)`, so dismissing `signals[0]` on a two-rule case let it recompute open under
  the other rule — looking to the admin like nothing happened despite an audit row being
  written. All three dismiss paths (row action, drawer, bulk) now dismiss every signal:
  `handleDismiss` takes `triggerKeys: string[]` and calls `dismissCaseAction` once per key
  sequentially, and the bulk path flattens each selected case into one entry per signal. The
  action and its Zod schema were left unchanged (single `triggerKey` per call) to keep the fix
  small. Covered by three new cases in `tests/component/reputation-cases-table.test.tsx`.

## Post-review: crash on any populated case (found via live-DB verification, not the test suite)

After the fix wave above landed and passed its own review, a live-database browser pass (seeding
real `seller_rating` rows to trigger `negative_streak` rather than relying on the empty-DB state)
surfaced a Critical bug none of the twelve task reviews, the whole-branch review, or the fix
wave's own re-review could see: **`hydrateCases()` in `features/reviews/db/reputation-cases.ts`
crashed `/admin/reviews/cases` the moment any seller matched a rule.**

Four raw-SQL sites bound a plain JS `string[]` via `= ANY(${sellerIds})`. Drizzle's `sql`
template sends an embedded array as a single stringified parameter rather than a Postgres array
literal, so every one of the four queries threw `PostgresError: malformed array literal` (code
`22P02`) as soon as `sellerIds` was non-empty. Every test in the suite mocks `db.execute`, so none
of them could exercise real Postgres array binding — the bug was invisible until a query actually
ran against a live database with matching rows, which never happened before this point since the
dev DB had zero `seller_rating` rows at every prior check (see "Known limitations" above).

**Fix:** all four sites now build one `sql.join()`-based parameterized `IN (...)` list from
`sellerIds` (computed once, reused across all four queries) instead of `= ANY(${sellerIds})`.
Verified two ways: (1) a direct query against the real dev Postgres returning an actual
`ReputationCase`, and independently a full browser session — login, table render, archive dialog,
detail drawer, zero console errors; (2) a regression guard in `tests/unit/reputation-cases.test.ts`
asserting no query contains `ANY(` and all four contain `IN (`, confirmed to actually fail when one
site was temporarily reverted.

**Known latent issue found during this fix, not yet fixed (zero current impact):**
`ReputationCase.recentReviews[].tags` is typed `string[]` but Postgres's
`array_agg(...)` result comes back from `db.execute` as a raw array-literal string
(`"{Bad Communication,Late}"`), not a parsed array — confirmed even with an explicit `::text[]`
cast. `ReputationCaseDrawer` never reads `.tags` today, so nothing breaks yet, but the type is a
lie and the first code to call `.map()`/`.length` on it will crash or behave unexpectedly. Same
"mocks can't see it" class as the bug above — worth fixing before any UI reads this field.
