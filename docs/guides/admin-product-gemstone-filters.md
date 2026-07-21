# Collaborator Guide: Admin Product Gemstone Filters

## What this feature does

`/admin/products` has five extra filters in the Filter panel: **Cut**, **Metal**, **Shape**, **Identification**, and **Weight (ct)**. Like `search`/`price`, selecting one updates the URL and re-fetches the product list server-side (not just the loaded page). The filter panel's option counts (e.g. "Faceted 8") reflect the true count across the whole catalog, not just the currently loaded page.

## Prerequisites

- Standard dev env (`.env.local`, PostgreSQL, `npm run dev`)
- No new env vars or dependencies

## End-to-end usage

1. Open `/admin/products` → click **Filter**
2. Check a Cut/Metal/Shape/Identification option, or drag the Weight slider — the URL updates (e.g. `?stoneCut=Faceted`) and the list re-fetches
3. Pagination, view-tab switches, and clicking into a product's edit page (prev/next nav) all carry the active filters forward
4. Checking a *second* option in the same filter (e.g. Cut) replaces the first — these are single-valued DB columns, not true multi-select

## Extending the filters

### Add a new enum filter (e.g. "Origin")

1. In `features/products/db/products.ts`: add the opt to `getAdminProductsFromDb`'s `opts` type, add an `eq()` condition to `filterConditions`, and select the column into `AdminProductRow` if you want to display it.
2. If you want accurate option counts (not just "count from the current page"), add a `countByYourField()` block to `getAdminProductFacetCounts` — copy the `countByStoneCut` pattern, but make sure the *other* facets' `countBy*` functions add an `eq()` for your new field, and your new field's own count function does **not** filter by itself.
3. In `app/admin/products/page.tsx`: parse the param from `searchParams` (validate against an allow-list, same as `STONE_CUTS`/`METALS`), pass it into `getAdminProductsFromDb` and `getAdminProductFacetCounts`.
4. In `features/products/components/ProductsListView.tsx`: add a `type: "multi"` `FilterDef` using `facetCounts.yourField[value] ?? 0`, and add a branch inside the `onFilterChange` batch loop that sets/deletes the param on the shared `params` object (see `admin-product-server-side-filters.md` for the batched `onFilterChange` shape — it receives every filter that changed in one update, not one call per filter). Use `values[values.length - 1]` for single-valued (`eq()`) columns, or `values.join(",")` + `inArray()` at the DB layer if you want true multi-select (see Type/Category/Moderation for that pattern).
5. Update `buildViewHref`/`buildPageHref`/`buildEditHref` in the same file (add to the `FORWARDED_PARAMS` list) and `resolve-adjacent.ts`/edit `page.tsx` if the field should survive prev/next navigation.

### Add a new range filter (e.g. a second numeric field)

Copy the `weight` pattern: a `type: "numrange"` `FilterDef` without a `currencies` array (single `min:`/`max:` value pair, no per-currency blocks), a `gte`/`lte` pair built the same way as `weightCondition` in `products.ts`, and a `filterRow` case for `weight`-like client-side re-validation (needed because the default `vals.includes(rv)` fallback in `ListViewCard` doesn't understand numeric ranges).

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| Unselected option always shows count 0 | Computing filter option counts from `products` (the already-filtered page) instead of `facetCounts` | Use `facetCounts.<field>[value] ?? 0`, and make sure your facet's own count query excludes its own filter value (see `getAdminProductFacetCounts`) |
| All rows disappear after picking a range filter | No `filterRow` case for that filter id — `ListViewCard`'s default fallback (`vals.includes(rv)`) can't match a `min:`/`max:` encoded value against a plain string field | Add a `filterRow` case that parses `min:`/`max:` and does a numeric comparison, like the `weight` case |
| Checking two boxes in Cut/Metal/Shape/Identification doesn't combine them | These are `eq()`-filtered single-valued DB columns, not `inArray()` | Either accept "last checked wins" (current behavior) or extend the DB layer to accept arrays and use `inArray()`, like Type/Category/Moderation do — see `admin-product-server-side-filters.md` |
| Selecting a second server-driven filter (or "Clear all" with 2+ active) loses all but one | `onFilterChange` receives the whole batch of changed filters at once — if your branch does its own separate `router.push` instead of mutating the shared `params` object, it'll stomp on other changes in the same batch | Mutate the shared `params` passed into your branch, set `handledAny = true`, and let the ONE `router.push` at the end of the loop fire — don't call `router.push` yourself except for the archive-style full-replace special case |
| Prev/next on the edit page ignores your new filter | `resolve-adjacent.ts`'s `ListContext` / edit `page.tsx` don't forward the param | Add the field to `ListContext`, `buildAdjacentHref`, `hasContext`, and `sharedOpts` in `resolve-adjacent.ts`, and to the edit page's `searchParams` type and `resolveAdjacentProducts(...)` call |
