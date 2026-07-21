# Admin Product Server-Side Filters (Type, Category, Moderation, Flags) + Batched Filter Changes

## What changed

**Bug:** on `/admin/products`, filtering by Type showed correct per-option counts (e.g. "Loose Stone 8"), but the page header ("12 total") and pagination footer ("Showing 1–12 of 12") never updated to match — because Type/Category/Moderation/Flags were purely client-side filters, narrowing only the rows already loaded on the current page. Beyond the display bug, this meant filtering by Type silently missed matches sitting on other pages once a catalog exceeds the page size (25) — the filter only ever looked at what was already fetched.

**Fix:** migrated Type, Category, Moderation, and Flags to URL-driven, DB-backed filters — the same pattern already used for `search`/`price` (see `admin-product-url-search.md`) and Cut/Metal/Shape/Identification/Weight (see `admin-product-gemstone-filters.md`). Unlike those four (single-valued `eq()` columns), Type/Category/Moderation are true multi-select (`inArray()` / OR'd category matching), and Flags stays AND-combined across `isFeatured`/`isCollectorPiece`/`isPrivilegeAssist`.

**Second bug found while testing the above:** selecting two server-driven filters at once (e.g. Type + Category together, or hitting "Clear all" with both active) only applied the *first* one — the second silently stuck in the URL. `ListViewCard.handleSetFilters` called the parent's `onFilterChange(filterId, values)` once per changed filter and `return`ed immediately after the first one that reported `handled: true`, so a second filter's `router.push` (built from the same now-stale `searchParams`) never ran. This is a pre-existing bug in the shared list-view component (not introduced by this change) that also affects the seller portal's product list (`PortalProductsListView`), since both consume the same `onFilterChange` contract.

**Fix:** `onFilterChange` now receives every filter that changed in a single update (an array), not one call per filter. Both consumers build one shared `URLSearchParams` across the whole batch and issue a single `router.push`.

**Files touched:**
- `features/products/db/products.ts` — `getAdminProductsFromDb` gained `productTypes`/`categoryIds`/`moderationStatuses` array opts (`inArray()`/OR'd multi-category matching), additive alongside the existing singular `productType`/`categoryId`/`moderationStatus`; `getAdminProductFacetCounts` extended to also compute `productType`, `moderationStatus`, `category` (id/name/count), and `flags` (featured/collector/privilege) counts
- `app/admin/products/page.tsx` — parses comma-separated `type`/`category`/`moderation`/`flags` URL params
- `app/admin/products/[id]/edit/page.tsx` and `resolve-adjacent.ts` — prev/next navigation carries these through too
- `features/products/components/ProductsListView.tsx` — Type/Category/Moderation/Flags `filterDefs` now read counts from `facetCounts`; `onFilterChange` rewritten to process a batch of changes into one `URLSearchParams`/`router.push`
- `features/products/components/PortalProductsListView.tsx` — `onFilterChange` rewritten to the same batched shape (status/price only)
- `components/admin/list-view/ListViewCard.tsx` — `onFilterChange` prop type changed from `(filterId, values) => boolean | void` to `(changes: Array<{ id, values }>) => boolean | void`; `handleSetFilters` now collects every changed filter id before calling it once, instead of calling it per-id and bailing after the first `handled: true`

## Data flow

```
URL ?type=loose_stone,jewellery&category=<id1>,<id2>&moderation=pending&flags=featured,collector
  → app/admin/products/page.tsx
      → parseMultiParam(params.type, PRODUCT_TYPES) etc. — comma list → validated array
      → getAdminProductsFromDb({ productTypes, categoryIds, moderationStatuses, isFeatured, isCollectorPiece, ... })
      → getAdminProductFacetCounts({ ...same })
      → <ProductsListView productTypes categoryIds moderationStatuses flags facetCounts />
          → user checks/unchecks options across one or more filter panels, clicks "Filter" (or "Clear all")
              → ListViewCard.handleSetFilters(next) — diffs `next` against current `filters`,
                collects ALL changed { id, values } pairs (not just the first)
              → onFilterChange(changes) — ProductsListView loops the batch, mutates ONE shared
                URLSearchParams, calls router.push ONCE
                  → URL updates → server re-fetches list + facet counts
```

Category multi-select ids are comma-joined into `?category=` with no allow-list validation possible (categories are DB-driven, not a fixed enum) — an invalid/deleted id just matches nothing, which `buildCategoryConditionMulti` handles safely via parameterized `eq()`/`exists()`, no injection risk.

Flags reuses the pre-existing `isFeatured`/`isCollectorPiece`/`isPrivilegeAssist` boolean opts (already supported at the DB layer for the view-tab logic) — checked flag values become `true`, unchecked ones stay `undefined` (not `false`, so they don't over-constrain).

## Facet counts

`getAdminProductFacetCounts` now runs 10 queries in parallel (`Promise.all`): `stoneCut`, `metal`, `shape`, `identification`, `productType`, `moderationStatus` (all `GROUP BY`), `category` (`GROUP BY` + name join), and three boolean counts (`featured`, `collector`, `privilege`). Each excludes only its own active filter value from its WHERE clause, same self-exclusion pattern as the gemstone facets.

The `category` facet counts by `product.categoryId` directly — it does **not** account for jewellery pieces whose embedded gemstones (`productJewelleryGemstone`) belong to a different category than the parent product (the richer OR-based matching `buildCategoryCondition` uses for actual filtering). This is a known, minor undercount for that edge case; the *filtering* itself (which products actually show up when a category is selected) is fully correct via `buildCategoryConditionMulti`.

## Schema impact

None — `productType`, `categoryId`, `moderationStatus`, `isFeatured`, `isCollectorPiece`, `isPrivilegeAssist` already existed on `product`. No migration.

## Auth & permissions

Server components only, same as the rest of `/admin/products` — requires an active admin session. No new API routes. `ListViewCard`'s contract change is internal to already-authenticated admin/portal pages.

## Edge cases & known limitations

- The "archive" status toggle keeps its pre-existing special-case behavior: it does a full URL replace (`?status=archive` or bare `/admin/products`) and returns immediately from the batch loop, rather than merging with other changes in the same batch. This mirrors what it did before — an edge case (archive + something else changing in the exact same click) that was already handled this way.
- Plain Status (draft/active/pending/sold, outside the archive special case) and `createdAt` were intentionally left as client-side-only filters — out of scope for this change. They still have the original "only correct within the current page" limitation; converting them would follow the same pattern as Type/Moderation.
- No index exists on `productType`, `moderationStatus`, `isFeatured`, `isCollectorPiece`, or `isPrivilegeAssist`. Fine at current catalog size; worth revisiting if the table grows substantially (same caveat as the gemstone filters' `stoneCut`/`metal`/`identification`/`weightCarat`).
