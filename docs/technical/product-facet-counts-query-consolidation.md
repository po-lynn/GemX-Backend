# Product Facet Counts: Consolidated 10 Queries into 2

## What changed

`getAdminProductFacetCounts` in `features/products/db/products.ts` fired 10 separate DB
queries via `Promise.all` on every `/admin/products` page load (6 `GROUP BY` queries, 1
category `GROUP BY`, 3 boolean-flag `COUNT` queries). Under production traffic this fan-out
of concurrent queries exhausted the Postgres connection pool (`max: 10` per instance, see
`drizzle/db.ts`), and because `statement_timeout` is intentionally disabled when using the
PgBouncer transaction-mode pooler (session-level `SET` is silently ignored there), a stalled
query had no safety net short of Vercel's own 300s function timeout — which is what was
happening in production (`Vercel Runtime Timeout Error: Task timed out after 300 seconds` on
every `/admin/products` load).

Rewrote it to compute all 9 fixed-enum facets (stone cut, metal, shape, identification,
product type, moderation status, and the three flag counts) in a **single query** using
`count(*) FILTER (WHERE ...)` — one expression per option value, each with its own
"omit this facet's own active filter" WHERE clause, same as before. Category counts stay a
separate query (categories are a dynamic, unbounded set, so they still need an actual
`GROUP BY` rather than fixed FILTER branches). Total: 10 round trips → 2.

## Why this is safe

- `count(*) FILTER (WHERE ...)` computes an independent conditional count per branch in one
  table scan; each branch's WHERE clause is byte-for-byte the same condition the old
  per-facet query used (built via the same `buildConditions(omit)` helper), so the
  "exclude a facet's own filter, keep every other active filter" semantics are unchanged.
- Verified via `tests/unit/product-color-textfield.test.ts`-style call-count assertions in
  `tests/unit/products-facet-counts.test.ts`: with an active `stoneCut` filter, the stoneCut
  facet's own WHERE omits it (0 of its 2 FILTER branches reference the active-filter
  condition beyond their direct value match) while every other facet/category WHERE still
  applies it.

## Data flow

Unchanged from the caller's perspective — `getAdminProductFacetCounts(opts)` still returns the
same `ProductFacetCounts` shape (`stoneCut`, `metal`, `shape`, `identification`, `productType`,
`moderationStatus` as `Record<string, number>`; `category` as an array; `flags` as
`{ featured, collector, privilege }`). `app/admin/products/page.tsx` and
`ProductsListView.tsx` needed no changes.

## Known limitations

- This removes the *query-count* cause of the connection-pool exhaustion, but production still
  has no `statement_timeout` under the PgBouncer pooler. A single slow/blocked query can still
  hang up to Vercel's function timeout with no faster failure path. A follow-up worth doing:
  `SET LOCAL statement_timeout` per-transaction (unlike session-level `SET`, this **does**
  survive PgBouncer transaction-mode pooling) as a defensive backstop.
- The consolidated query still does a single `count(*) FILTER (...)` per option value (22
  branches across stone cut/metal/shape/identification/product type/moderation/flags), all in
  one query — Postgres evaluates these efficiently in one pass, but if more facets are added in
  the future, prefer extending this pattern (more FILTER branches in the same query) over
  adding new standalone queries.
