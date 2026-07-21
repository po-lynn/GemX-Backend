# Admin Product Gemstone Filters (Cut, Metal, Shape, Identification, Weight)

## What changed

Added five URL-driven, server-side filters to the admin products list (`/admin/products`): Cut, Metal, Shape, Identification, and Weight (carat range). These follow the same pattern established for `search`/`price` (see `admin-product-url-search.md`) — the DB layer already supported `stoneCut`/`metal`/`shape`/`identification` as `eq()` filters, but they weren't exposed as URL params or filter UI.

A follow-up fix in the same change: the filter panel's per-option counts (e.g. "Faceted 8 / Cabochon 3") were initially computed from `products.filter(...).length` over the currently loaded page. Since selecting one of these filters triggers a full server refetch (the loaded rows narrow to just the matching value), every *other* option in that same filter always showed a count of 0 — even when matching products existed. Counts now come from a dedicated aggregate query (`getAdminProductFacetCounts`) that computes true counts across the whole matching set, independent of pagination.

**Files touched:**
- `features/products/db/products.ts` — `getAdminProductsFromDb`/`getProductsBySellerId` gained `weightMin`/`weightMax` range filtering and `shape`/`weightCarat` in their row projections; new `getAdminProductFacetCounts` function
- `app/admin/products/page.tsx` — parses `stoneCut`, `metal`, `shape`, `identification`, `weightMin`, `weightMax` from `searchParams`; calls `getAdminProductFacetCounts` alongside the list/count queries
- `app/admin/products/[id]/edit/page.tsx` and `resolve-adjacent.ts` — prev/next navigation on the edit page now carries these filters through so it stays consistent with the active list filter
- `features/products/components/ProductsListView.tsx` — new filter defs, URL-param interception in `onFilterChange`, client-side `filterRow` case for `weight`

## Data flow

```
URL ?stoneCut=Faceted&metal=Gold&shape=Oval&identification=Natural&weightMin=1&weightMax=5
  → app/admin/products/page.tsx (server component)
      → getAdminProductsFromDb({ stoneCut, metal, shape, identification, weightMin, weightMax, ... })  — the page of matching rows
      → getAdminProductFacetCounts({ stoneCut, metal, shape, identification, ... })                     — true per-option counts
      → <ProductsListView stoneCut metal shape identification weightMin weightMax facetCounts />
          → filterDefs: stoneCut/metal/shape/identification ("multi" checkbox list), weight ("numrange")
          → user checks/unchecks an option or drags the weight slider
              → onFilterChange intercepts (returns true) → router.push with updated URL params, page reset to 1
                  → URL updates → server re-fetches list + facet counts
```

Cut/Metal/Shape/Identification are single-valued DB columns (`eq()`, not `inArray()`), but the filter UI is a checkbox list (the only "pick from options" affordance `ListViewCard`'s `FilterDef` system supports). `onFilterChange` takes `values[values.length - 1]` — i.e. "last checked wins" — so checking a second box replaces the first rather than combining them.

## Facet counts (`getAdminProductFacetCounts`)

For each of the four enum facets, the count for option X is: rows matching search + view + price + weight + *every other active enum filter*, grouped by that facet's column — but **not** filtered by that facet's own active value:

- `stoneCut` counts respect an active `metal`/`shape`/`identification` filter, but ignore `opts.stoneCut`
- `metal` counts respect `stoneCut`/`shape`/`identification`, but ignore `opts.metal`
- (same pattern for `shape` and `identification`)

This is the standard "faceted search" convention — selecting Cut=Faceted still shows the real Cabochon count instead of always reporting 0. It costs 4 small `GROUP BY` queries per page load (each grouping a low-cardinality enum column), run in parallel via `Promise.all`.

Weight has no per-option counts (it's a continuous range, not a checkbox list), so it doesn't need a facet query.

## Schema impact

None — `stoneCut`, `metal`, `shape`, `identification`, `weightCarat` already existed on `product`. No migration.

## Auth & permissions

Server component only, same as the rest of `/admin/products` — requires an active admin session. No new API routes.

## Edge cases & known limitations

- No index exists on `stoneCut`, `metal`, `identification`, or `weightCarat` (only `shape` has one). The facet `GROUP BY` queries and the `eq()`/range filters will do sequential scans on large tables — fine at current catalog size, worth revisiting if the products table grows substantially.
- The checkbox UI's "last checked wins" behavior can look odd if a user rapidly multi-selects — unlike `type`/`category`/`moderation` (true multi-value `inArray()` filters, see `admin-product-server-side-filters.md`), these four are `eq()`-filtered single-valued DB columns.
- Weight range values are plain numbers (carats); no currency-style unit conversion needed.
