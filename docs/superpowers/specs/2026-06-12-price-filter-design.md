# Price Filter with Custom Range — Admin Products List

**Date:** 2026-06-12  
**Scope:** `/admin/products` — add server-side price range filtering for USD and MMK products  

---

## Overview

Add two numeric range filters ("USD Price" and "MMK Price") to the admin products list. Filtering is server-side so it works across all products, not just the current page. The implementation extends the existing `ListViewCard` filter system with a new `numrange` FilterDef type, keeping the UI consistent with existing filters (chips, badge count, Clear all).

---

## Architecture

Six files touched across four layers:

| Layer | File | Change |
|---|---|---|
| Types | `components/admin/list-view/types.ts` | Add `numrange` to `FilterDef` union |
| UI | `components/admin/list-view/ListViewCard.tsx` | `NumRangePaneContent`, `numrange` handling in `FilterPanel` + chips |
| Feature | `features/products/components/ProductsListView.tsx` | Two numrange filterDefs, `onFilterChange` URL push, `filterRow`, `defaultFilters` props |
| DB | `features/products/db/products.ts` | Four new opts + SQL conditions |
| Cache | `features/products/db/cache/products.ts` | Forward four new params |
| Page | `app/admin/products/page.tsx` | Read + parse four new search params |

---

## Section 1 — FilterDef type

Add one variant to the `FilterDef` union in `types.ts`:

```ts
| { id: string; label: string; type: "numrange"; placeholders?: { min?: string; max?: string } }
```

Values are stored in the `string[]` as `min:500` and `max:5000` — same encoding pattern as `daterange` uses `from:` / `to:`.

---

## Section 2 — ListViewCard

### NumRangePaneContent

New component alongside `DateRangePaneContent`. Renders two `<input type="number">` fields (Min / Max). Helpers `nrMin(vals)` and `nrMax(vals)` extract the numeric bounds from the encoded string array.

### FilterPanel changes

Three locations updated (mirroring existing daterange handling):

1. **`defCount`** — returns 1 if either `min:` or `max:` is present in the filter vals.
2. **Pane rendering** — `numrange` branch renders `NumRangePaneContent` with a Clear button when either bound is set.
3. **Active chips** — label format:
   - Both bounds: `500 – 5,000`
   - Min only: `≥ 500`
   - Max only: `≤ 5,000`
   - Chip value key: `"__numrange__"` (so `removeChip` deletes the whole entry, same as `"__daterange__"`)

---

## Section 3 — ProductsListView

### New filterDefs

```ts
{ id: "priceUSD", label: "USD Price", type: "numrange" }
{ id: "priceMMK", label: "MMK Price", type: "numrange" }
```

### onFilterChange

When `filterId` is `"priceUSD"` or `"priceMMK"`, parse `min:`/`max:` from the vals, build URL search params (`priceMinUSD`, `priceMaxUSD`, `priceMinMMK`, `priceMaxMMK`), push with `router.push`, and return `true` to prevent client-side filtering.

Existing params (page, view, search, status) are preserved when pushing; `page` is reset to 1.

### filterRow

Handles `priceUSD` and `priceMMK` for local sort/group consistency:

```ts
case "priceUSD": {
  if (r.currency !== "USD") return false
  const min = nrMin(vals); const max = nrMax(vals)
  const p = Number(r.price)
  if (min && p < Number(min)) return false
  if (max && p > Number(max)) return false
  return true
}
// mirror for priceMMK
```

### defaultFilters (pre-population from URL)

The page passes the four URL params as props. `ProductsListView` converts them to `defaultFilters`:

```ts
const defaultFilters: ActiveFilters = {}
if (priceMinUSD || priceMaxUSD) {
  defaultFilters.priceUSD = [
    ...(priceMinUSD ? [`min:${priceMinUSD}`] : []),
    ...(priceMaxUSD ? [`max:${priceMaxUSD}`] : []),
  ]
}
// mirror for MMK
```

### New props

```ts
type Props = {
  // ... existing props
  priceMinUSD?: string
  priceMaxUSD?: string
  priceMinMMK?: string
  priceMaxMMK?: string
}
```

---

## Section 4 — DB layer

### New opts on `getAdminProductsFromDb`

```ts
priceMinUSD?: number
priceMaxUSD?: number
priceMinMMK?: number
priceMaxMMK?: number
```

### SQL conditions

Build two optional condition groups:

```ts
const usdRange = (opts.priceMinUSD != null || opts.priceMaxUSD != null)
  ? and(
      eq(product.currency, "USD"),
      opts.priceMinUSD != null ? gte(product.price, String(opts.priceMinUSD)) : undefined,
      opts.priceMaxUSD != null ? lte(product.price, String(opts.priceMaxUSD)) : undefined,
    )
  : undefined

const mmkRange = (opts.priceMinMMK != null || opts.priceMaxMMK != null)
  ? and(
      eq(product.currency, "MMK"),
      opts.priceMinMMK != null ? gte(product.price, String(opts.priceMinMMK)) : undefined,
      opts.priceMaxMMK != null ? lte(product.price, String(opts.priceMaxMMK)) : undefined,
    )
  : undefined

const priceCondition = usdRange && mmkRange
  ? or(usdRange, mmkRange)
  : usdRange ?? mmkRange
```

`priceCondition` is added to `filterConditions`. If neither range is set, nothing is added.

**Semantics:**
- USD range only → shows USD products in range (MMK products excluded)
- MMK range only → shows MMK products in range (USD products excluded)
- Both → shows products matching either range

---

## Section 5 — Cache + Page

### `features/products/db/cache/products.ts`

`getAdminProducts` forwards `priceMinUSD`, `priceMaxUSD`, `priceMinMMK`, `priceMaxMMK` to `getAdminProductsFromDb`.

### `app/admin/products/page.tsx`

```ts
type Props = {
  searchParams: Promise<{
    page?: string; view?: string; search?: string; status?: string
    priceMinUSD?: string; priceMaxUSD?: string
    priceMinMMK?: string; priceMaxMMK?: string
  }>
}
```

Parse with `Number()` — if the value is not a finite positive number, pass `undefined` to the DB function. Pass the raw strings as props to `ProductsListView` for `defaultFilters`.

---

## Edge Cases

- Non-numeric or negative input: ignored (treated as unset) in both URL parsing and the number inputs
- Max < Min: DB still executes; returns empty set for that currency — no special handling needed
- Price column is stored as `numeric` in Postgres; Drizzle passes string values which Postgres coerces correctly
- Clearing individual price chip removes both min and max for that currency (`"__numrange__"` key)
- Clear all resets both price filters along with all others

---

## Out of Scope

- Cross-currency conversion (USD ↔ MMK)
- Price filter on seller-facing or public product lists (`getProductsBySellerId` not changed)
- Preset ranges (e.g. "Under $500") — plain min/max inputs only
