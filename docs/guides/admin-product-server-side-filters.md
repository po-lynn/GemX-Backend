# Collaborator Guide: Admin Product Server-Side Filters (Type, Category, Moderation, Flags)

## What this feature does

Type, Category, Moderation, and Flags on `/admin/products` are now real server-side filters — same as `search`/`price` and Cut/Metal/Shape/Identification/Weight. Selecting them updates the URL and re-fetches from the DB, so the page header total, the pagination footer ("Showing X–Y of Z"), and the filter panel's option counts all stay accurate — not just correct for whatever happened to be on the currently loaded page.

Also: `ListViewCard`'s `onFilterChange` prop now receives a *batch* of every filter that changed in one update (e.g. checking two different filters before clicking "Filter", or "Clear all" wiping several at once), not one call per changed filter. If you maintain a page that uses `ListViewCard` with `onFilterChange`, you need the batched shape — see below.

## Prerequisites

- Standard dev env (`.env.local`, PostgreSQL, `npm run dev`)
- No new env vars or dependencies

## End-to-end usage

1. Open `/admin/products` → click **Filter**
2. Check one or more Type/Category/Moderation/Flags options across one or more filter tabs, then click **Filter** (or click a checkbox that auto-applies) — the URL updates with comma-joined values (e.g. `?type=loose_stone,jewellery&category=<id1>,<id2>`)
3. The header total and "Showing X–Y of Z" now match the filtered count, at any catalog size
4. "Clear all" removes every active filter from the URL in one navigation, even when multiple server-driven filters were active at once

## Extending the filters

### Add a new `ListViewCard` page with `onFilterChange`

The callback shape is:
```ts
onFilterChange?: (changes: ReadonlyArray<{ id: string; values: string[] }>) => boolean | void
```
Write it as a loop over `changes`, mutating ONE shared `URLSearchParams` built from `searchParams.toString()`, setting a `handledAny` flag per recognized filter id, and doing exactly one `router.push` at the end if `handledAny`:
```ts
onFilterChange={(changes) => {
  const params = new URLSearchParams(searchParams.toString())
  let handledAny = false
  for (const { id: filterId, values } of changes) {
    if (filterId === "yourFilter") {
      if (values.length > 0) params.set("yourFilter", values.join(",")); else params.delete("yourFilter")
      handledAny = true
      continue
    }
  }
  if (handledAny) {
    params.set("page", "1")
    router.push(`${BASE}?${params.toString()}`)
    return true
  }
}}
```
Don't call `router.push` per-branch (that's the bug this migration fixed) — only the archive-style "full URL replace and bail immediately" special case should `return true` without going through the shared `params`/`handledAny` path, and only when that filter change genuinely can't coexist with anything else in the same batch.

### Add a new true multi-select filter (OR semantics, e.g. another `inArray()` column)

1. `features/products/db/products.ts`: add a `yourFields?: ReadonlyArray<...>` opt to `getAdminProductsFromDb`, and `opts.yourFields?.length ? inArray(product.yourColumn, [...opts.yourFields]) : undefined` to `filterConditions`.
2. `getAdminProductFacetCounts`: add `yourField` to `FacetKey`, a `countGroupBy(product.yourColumn, "yourField")` call in the `Promise.all`, and make sure `buildConditions` skips your field's own condition when `omit === "yourField"`.
3. `app/admin/products/page.tsx`: add a `parseMultiParam(params.yourParam, YOUR_ALLOWED_VALUES)` call, pass the resulting array into both DB calls and down to `ProductsListView`.
4. `ProductsListView.tsx`: add the prop, add it to `defaultServerFilters`, add a `type: "multi"` `FilterDef` using `facetCounts.yourField[value] ?? 0`, and add a branch in the `onFilterChange` loop that does `values.length > 0 ? params.set(id, values.join(",")) : params.delete(id)`.
5. Category ids can't be allow-list-validated (they're DB rows, not a fixed enum) — just trim/dedupe/drop-empty (see `parseCategoryIds`); an invalid id safely matches zero rows.

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| Selecting 2 filters (or "Clear all" with 2+ active) only applies the first | Your `onFilterChange` calls `router.push` separately per filter instead of accumulating into one shared `URLSearchParams` | Restructure to the loop-over-`changes` pattern above — one `params` object, one `router.push` |
| New multi-select filter's unselected option always shows 0 after filtering | Facet counts computed by filtering the loaded page's rows, or the facet count query didn't exclude its own filter | Use `getAdminProductFacetCounts`, and make sure `buildConditions(omit)` actually skips the condition when `omit` matches your field |
| Category option list is missing categories with 0 currently-visible products | Expected — `facetCounts.category` only lists categories that have at least one row (an inner aggregate `GROUP BY`, not a `LEFT JOIN` against the full category table) | If you need every category listed regardless of count, join against `getAllCategories()` and default missing ones to 0 |
| TypeScript error: `onFilterChange` argument shape mismatch | Old code still uses the pre-migration `(filterId: string, values: string[])` shape | Update to `(changes: ReadonlyArray<{ id: string; values: string[] }>)` and loop over it |
