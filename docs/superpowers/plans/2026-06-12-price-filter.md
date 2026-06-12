# Price Filter with Custom Range — Admin Products List

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side USD and MMK price range filters to `/admin/products`, integrated into the existing `ListViewCard` filter panel with chips, badge count, and Clear all.

**Architecture:** Extend `FilterDef` with a new `numrange` type (parallel to existing `daterange`), implement `NumRangePaneContent` in `ListViewCard`, wire two `numrange` filter defs in `ProductsListView` with `onFilterChange` pushing URL params, add four price opts to the DB query, and read those params from the page's `searchParams`.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, React 19, TypeScript, Vitest

---

## File Map

| File | Change |
|---|---|
| `components/admin/list-view/types.ts` | Add `numrange` variant to `FilterDef` union |
| `components/admin/list-view/ListViewCard.tsx` | Add `nrMin`/`nrMax`/`nrFmt` helpers, `NumRangePaneContent`, handle `numrange` in `FilterPanel` (defCount, pane, selectAll, totalSelected) + active chips + `removeChip` |
| `features/products/components/ProductsListView.tsx` | Add 4 price props, two `numrange` filterDefs, `onFilterChange` URL push, `filterRow` cases, `defaultFilters` construction |
| `features/products/db/products.ts` | Add `priceMinUSD/priceMaxUSD/priceMinMMK/priceMaxMMK` opts + SQL condition |
| `features/products/db/cache/products.ts` | Forward the four new opts through `getAdminProducts` |
| `app/admin/products/page.tsx` | Read + parse four new search params, pass to DB + `ProductsListView` |
| `tests/unit/price-filter.test.ts` | Unit tests for `filterRow` price logic and `defaultFilters` construction |

---

## Task 1: Extend FilterDef type

**Files:**
- Modify: `components/admin/list-view/types.ts`

- [ ] **Step 1: Add `numrange` to the FilterDef union**

Open `components/admin/list-view/types.ts`. The current `FilterDef` union ends at line 29. Add the new variant:

```ts
export type FilterDef =
  | { id: string; label: string; type: "multi"; options: FilterOption[] }
  | { id: string; label: string; type: "daterange" }
  | { id: string; label: string; type: "toggle" }
  | { id: string; label: string; type: "numrange"; placeholders?: { min?: string; max?: string } }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `FilterDef`.

- [ ] **Step 3: Commit**

```bash
git add components/admin/list-view/types.ts
git commit -m "feat: add numrange variant to FilterDef type"
```

---

## Task 2: Implement numrange UI in ListViewCard

**Files:**
- Modify: `components/admin/list-view/ListViewCard.tsx`

- [ ] **Step 1: Add numrange value helpers after the existing daterange helpers (around line 65)**

The file currently has `drFrom`, `drTo`, `drFmt` for daterange. Add three analogous helpers directly below them:

```ts
// ─── Numrange helpers ──────────────────────────────────────
function nrMin(vals: string[]): string {
  return vals.find((v) => v.startsWith("min:"))?.substring(4) ?? ""
}
function nrMax(vals: string[]): string {
  return vals.find((v) => v.startsWith("max:"))?.substring(4) ?? ""
}
function nrFmt(val: string): string {
  if (!val) return ""
  return Number(val).toLocaleString()
}
```

- [ ] **Step 2: Add NumRangePaneContent component after DateRangePaneContent (after line 118)**

```tsx
// ─── NumRangePaneContent ───────────────────────────────────
function NumRangePaneContent({
  value,
  onChange,
  placeholders,
}: {
  value: string[] | undefined
  onChange: (v: string[]) => void
  placeholders?: { min?: string; max?: string }
}) {
  const vals = value ?? []
  const min = nrMin(vals)
  const max = nrMax(vals)

  function setMin(n: string) {
    const next = vals.filter((v) => !v.startsWith("min:"))
    onChange(n ? [...next, `min:${n}`] : next)
  }
  function setMax(n: string) {
    const next = vals.filter((v) => !v.startsWith("max:"))
    onChange(n ? [...next, `max:${n}`] : next)
  }

  return (
    <div className="lv-daterange" style={{ padding: "4px 14px 10px" }}>
      <div className="lv-daterange-row">
        <label className="lv-daterange-label">Min</label>
        <input
          type="number"
          className="lv-daterange-input"
          value={min}
          min={0}
          placeholder={placeholders?.min ?? "0"}
          onChange={(e) => setMin(e.target.value)}
        />
      </div>
      <div className="lv-daterange-row">
        <label className="lv-daterange-label">Max</label>
        <input
          type="number"
          className="lv-daterange-input"
          value={max}
          min={0}
          placeholder={placeholders?.max ?? "∞"}
          onChange={(e) => setMax(e.target.value)}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update `totalSelected` in FilterPanel to count numrange as 1 (around line 136)**

Existing code:
```ts
const isDR = v.some((x) => x.startsWith("from:") || x.startsWith("to:"))
```

Replace with:
```ts
const isDR = v.some(
  (x) => x.startsWith("from:") || x.startsWith("to:") || x.startsWith("min:") || x.startsWith("max:")
)
```

- [ ] **Step 4: Update `defCount` in FilterPanel to handle numrange (around line 171)**

Existing:
```ts
return vals.some((x) => x.startsWith("from:") || x.startsWith("to:")) ? 1 : vals.length
```

Replace with:
```ts
return vals.some(
  (x) => x.startsWith("from:") || x.startsWith("to:") || x.startsWith("min:") || x.startsWith("max:")
) ? 1 : vals.length
```

- [ ] **Step 5: Guard `selectAll` against numrange (around line 150)**

Existing:
```ts
function selectAll() {
  if (!def || def.type === "daterange" || def.type === "toggle") return
```

Replace with:
```ts
function selectAll() {
  if (!def || def.type === "daterange" || def.type === "numrange" || def.type === "toggle") return
```

- [ ] **Step 6: Add `numrange` branch to the FilterPanel pane renderer (around line 220)**

The pane content currently reads:
```tsx
{def && def.type === "daterange" ? (
  ...daterange block...
) : def && def.type === "multi" ? (
  ...multi block...
) : null}
```

Insert the `numrange` branch between `daterange` and `multi`:
```tsx
{def && def.type === "daterange" ? (
  <>
    <div className="lv-filter-pane-head">
      <span className="lv-filter-pane-title">{def.label}</span>
      {defCount(def.id) > 0 && (
        <div className="lv-filter-pane-actions">
          <button onClick={() => clearDef(def.id)}>Clear</button>
        </div>
      )}
    </div>
    <DateRangePaneContent
      value={filters[def.id]}
      onChange={(v) => setFilters({ ...filters, [def.id]: v })}
    />
  </>
) : def && def.type === "numrange" ? (
  <>
    <div className="lv-filter-pane-head">
      <span className="lv-filter-pane-title">{def.label}</span>
      {defCount(def.id) > 0 && (
        <div className="lv-filter-pane-actions">
          <button onClick={() => clearDef(def.id)}>Clear</button>
        </div>
      )}
    </div>
    <NumRangePaneContent
      value={filters[def.id]}
      onChange={(v) => setFilters({ ...filters, [def.id]: v })}
      placeholders={"placeholders" in def ? def.placeholders : undefined}
    />
  </>
) : def && def.type === "multi" ? (
  <>
    ...existing multi block unchanged...
  </>
) : null}
```

- [ ] **Step 7: Add `numrange` to the active chips builder (around line 830)**

The `activeChips` loop currently handles `daterange`, `toggle`, and the default (multi). Add a `numrange` branch after the `daterange` branch:

```ts
} else if (def.type === "numrange") {
  const min = nrMin(vals)
  const max = nrMax(vals)
  if (!min && !max) continue
  const label =
    min && max
      ? `${nrFmt(min)} – ${nrFmt(max)}`
      : min
        ? `≥ ${nrFmt(min)}`
        : `≤ ${nrFmt(max)}`
  activeChips.push({ defId, value: "__numrange__", defLabel: def.label, valueLabel: label })
```

- [ ] **Step 8: Update `removeChip` to handle `__numrange__` (around line 854)**

Existing:
```ts
if (value === "__daterange__") {
  delete next[defId]
}
```

Replace with:
```ts
if (value === "__daterange__" || value === "__numrange__") {
  delete next[defId]
}
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add components/admin/list-view/ListViewCard.tsx
git commit -m "feat: add numrange filter type to ListViewCard"
```

---

## Task 3: Wire price filters into ProductsListView

**Files:**
- Modify: `features/products/components/ProductsListView.tsx`

- [ ] **Step 1: Add four price props to the `Props` type (around line 120)**

Current `Props`:
```ts
type Props = {
  products: AdminProductRow[]
  views: ViewTab[]
  activeView: string
  page: number
  pageSize: number
  total: number
  search?: string
}
```

Replace with:
```ts
type Props = {
  products: AdminProductRow[]
  views: ViewTab[]
  activeView: string
  page: number
  pageSize: number
  total: number
  search?: string
  priceMinUSD?: string
  priceMaxUSD?: string
  priceMinMMK?: string
  priceMaxMMK?: string
}
```

- [ ] **Step 2: Destructure the four new props in the function signature (around line 130)**

Current:
```ts
export function ProductsListView({
  products,
  views,
  activeView,
  page,
  pageSize,
  total,
  search,
}: Props) {
```

Replace with:
```ts
export function ProductsListView({
  products,
  views,
  activeView,
  page,
  pageSize,
  total,
  search,
  priceMinUSD,
  priceMaxUSD,
  priceMinMMK,
  priceMaxMMK,
}: Props) {
```

- [ ] **Step 3: Build `defaultPriceFilters` from props (add after the `isArchiveView` line, around line 143)**

```ts
const defaultPriceFilters: Record<string, string[]> = {}
if (priceMinUSD || priceMaxUSD) {
  defaultPriceFilters.priceUSD = [
    ...(priceMinUSD ? [`min:${priceMinUSD}`] : []),
    ...(priceMaxUSD ? [`max:${priceMaxUSD}`] : []),
  ]
}
if (priceMinMMK || priceMaxMMK) {
  defaultPriceFilters.priceMMK = [
    ...(priceMinMMK ? [`min:${priceMinMMK}`] : []),
    ...(priceMaxMMK ? [`max:${priceMaxMMK}`] : []),
  ]
}
```

- [ ] **Step 4: Add two `numrange` entries to `filterDefs` (in the `filterDefs` array, after the `createdAt` daterange entry, around line 360)**

```ts
{ id: "priceUSD", label: "USD Price", type: "numrange" as const },
{ id: "priceMMK", label: "MMK Price", type: "numrange" as const },
```

The full `filterDefs` array becomes:
```ts
const filterDefs: FilterDef[] = [
  {
    id: "type",
    label: "Type",
    type: "multi",
    options: [ ... ],
  },
  {
    id: "category",
    label: "Category",
    type: "multi",
    options: uniqueCategories,
  },
  {
    id: "status",
    label: "Status",
    type: "multi",
    options: [ ... ],
  },
  {
    id: "moderation",
    label: "Moderation",
    type: "multi",
    options: [ ... ],
  },
  {
    id: "flags",
    label: "Flags",
    type: "multi",
    options: [ ... ],
  },
  { id: "createdAt", label: "Created", type: "daterange" },
  { id: "priceUSD", label: "USD Price", type: "numrange" },
  { id: "priceMMK", label: "MMK Price", type: "numrange" },
]
```

- [ ] **Step 5: Add `priceUSD` and `priceMMK` cases to `filterRow` (inside the `filterRow` prop of `ListViewCard`, around line 411)**

Add two new cases to the existing `switch (filterId)`:

```ts
case "priceUSD": {
  if (r.currency !== "USD") return false
  const min = vals.find((v) => v.startsWith("min:"))?.substring(4)
  const max = vals.find((v) => v.startsWith("max:"))?.substring(4)
  const p = Number(r.price)
  if (min && p < Number(min)) return false
  if (max && p > Number(max)) return false
  return true
}
case "priceMMK": {
  if (r.currency !== "MMK") return false
  const min = vals.find((v) => v.startsWith("min:"))?.substring(4)
  const max = vals.find((v) => v.startsWith("max:"))?.substring(4)
  const p = Number(r.price)
  if (min && p < Number(min)) return false
  if (max && p > Number(max)) return false
  return true
}
```

- [ ] **Step 6: Add price URL push to `onFilterChange` (after the existing `status` block)**

Current `onFilterChange`:
```tsx
onFilterChange={(filterId, values) => {
  if (filterId === "status") {
    if (values.includes("archive")) {
      router.push(`${BASE}?status=archive`)
      return true
    }
    if (isArchiveView) {
      router.push(BASE)
      return true
    }
  }
}}
```

Replace with:
```tsx
onFilterChange={(filterId, values) => {
  if (filterId === "status") {
    if (values.includes("archive")) {
      router.push(`${BASE}?status=archive`)
      return true
    }
    if (isArchiveView) {
      router.push(BASE)
      return true
    }
  }
  if (filterId === "priceUSD" || filterId === "priceMMK") {
    const params = new URLSearchParams(searchParams.toString())
    const minKey = filterId === "priceUSD" ? "priceMinUSD" : "priceMinMMK"
    const maxKey = filterId === "priceUSD" ? "priceMaxUSD" : "priceMaxMMK"
    const min = values.find((v) => v.startsWith("min:"))?.substring(4)
    const max = values.find((v) => v.startsWith("max:"))?.substring(4)
    if (min) params.set(minKey, min); else params.delete(minKey)
    if (max) params.set(maxKey, max); else params.delete(maxKey)
    params.set("page", "1")
    router.push(`${BASE}?${params.toString()}`)
    return true
  }
}}
```

- [ ] **Step 7: Merge `defaultPriceFilters` into the `defaultFilters` prop of `ListViewCard`**

Current:
```tsx
defaultFilters={isArchiveView ? { status: ["archive"] } : undefined}
```

Replace with:
```tsx
defaultFilters={{
  ...(isArchiveView ? { status: ["archive"] } : {}),
  ...defaultPriceFilters,
}}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add features/products/components/ProductsListView.tsx
git commit -m "feat: add USD/MMK price range filters to ProductsListView"
```

---

## Task 4: Add price filter opts to the DB layer

**Files:**
- Modify: `features/products/db/products.ts`
- Modify: `features/products/db/cache/products.ts`

- [ ] **Step 1: Add four opts to `getAdminProductsFromDb` signature (around line 126)**

In the opts object of `getAdminProductsFromDb`, after the `isPromotion` field, add:

```ts
priceMinUSD?: number
priceMaxUSD?: number
priceMinMMK?: number
priceMaxMMK?: number
```

- [ ] **Step 2: Build the price SQL condition (add after the `createdToDate` computation, around line 182)**

```ts
const usdRange =
  opts.priceMinUSD != null || opts.priceMaxUSD != null
    ? and(
        eq(product.currency, "USD"),
        opts.priceMinUSD != null ? gte(product.price, String(opts.priceMinUSD)) : undefined,
        opts.priceMaxUSD != null ? lte(product.price, String(opts.priceMaxUSD)) : undefined,
      )
    : undefined

const mmkRange =
  opts.priceMinMMK != null || opts.priceMaxMMK != null
    ? and(
        eq(product.currency, "MMK"),
        opts.priceMinMMK != null ? gte(product.price, String(opts.priceMinMMK)) : undefined,
        opts.priceMaxMMK != null ? lte(product.price, String(opts.priceMaxMMK)) : undefined,
      )
    : undefined

const priceCondition =
  usdRange && mmkRange ? or(usdRange, mmkRange) : usdRange ?? mmkRange
```

- [ ] **Step 3: Add `priceCondition` to `filterConditions` (in the `filterConditions` array, around line 183)**

Append `priceCondition` as the last entry in the array:

```ts
const filterConditions = [
  searchCondition,
  opts.productType ? eq(product.productType, opts.productType) : undefined,
  // ... all existing conditions ...
  opts.isPromotion === true ? eq(product.isPromotion, true) : undefined,
  priceCondition,
].filter(Boolean)
```

- [ ] **Step 4: Add the four opts to `getAdminProducts` in the cache layer**

Open `features/products/db/cache/products.ts`. In the opts type of `getAdminProducts` (after `sortOrder`), add:

```ts
priceMinUSD?: number
priceMaxUSD?: number
priceMinMMK?: number
priceMaxMMK?: number
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add features/products/db/products.ts features/products/db/cache/products.ts
git commit -m "feat: add price range filter opts to DB query and cache layer"
```

---

## Task 5: Wire search params in the page

**Files:**
- Modify: `app/admin/products/page.tsx`

- [ ] **Step 1: Extend the `searchParams` type to include four new params (around line 15)**

Current:
```ts
type Props = {
  searchParams: Promise<{ page?: string; view?: string; search?: string; status?: string }>
}
```

Replace with:
```ts
type Props = {
  searchParams: Promise<{
    page?: string
    view?: string
    search?: string
    status?: string
    priceMinUSD?: string
    priceMaxUSD?: string
    priceMinMMK?: string
    priceMaxMMK?: string
  }>
}
```

- [ ] **Step 2: Parse the four params after the existing param parsing (around line 27)**

After the existing `const statusFilter = params.status?.trim() || undefined` line, add:

```ts
function parsePrice(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const n = Number(raw)
  return isFinite(n) && n >= 0 ? n : undefined
}

const priceMinUSD = parsePrice(params.priceMinUSD)
const priceMaxUSD = parsePrice(params.priceMaxUSD)
const priceMinMMK = parsePrice(params.priceMinMMK)
const priceMaxMMK = parsePrice(params.priceMaxMMK)
```

- [ ] **Step 3: Pass price opts to `getAdminProducts` (in the `Promise.all`, around line 40)**

Current:
```ts
getAdminProducts({ page, limit: PAGE_SIZE, search, ...viewFilter }),
```

Replace with:
```ts
getAdminProducts({
  page,
  limit: PAGE_SIZE,
  search,
  ...viewFilter,
  priceMinUSD,
  priceMaxUSD,
  priceMinMMK,
  priceMaxMMK,
}),
```

- [ ] **Step 4: Pass raw string props to `ProductsListView` (around line 83)**

Current:
```tsx
<ProductsListView
  products={products}
  views={views}
  activeView={view}
  page={page}
  pageSize={PAGE_SIZE}
  total={total}
  search={search}
/>
```

Replace with:
```tsx
<ProductsListView
  products={products}
  views={views}
  activeView={view}
  page={page}
  pageSize={PAGE_SIZE}
  total={total}
  search={search}
  priceMinUSD={params.priceMinUSD}
  priceMaxUSD={params.priceMaxUSD}
  priceMinMMK={params.priceMinMMK}
  priceMaxMMK={params.priceMaxMMK}
/>
```

- [ ] **Step 5: Verify TypeScript compiles with no errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: clean output.

- [ ] **Step 6: Commit**

```bash
git add app/admin/products/page.tsx
git commit -m "feat: read and forward price range search params in admin products page"
```

---

## Task 6: Tests

**Files:**
- Create: `tests/unit/price-filter.test.ts`

- [ ] **Step 1: Write tests for the `filterRow` price logic and `defaultFilters` construction**

Create `tests/unit/price-filter.test.ts`:

```ts
import { describe, it, expect } from "vitest"

// ─── Inline the filterRow logic under test ─────────────────
// (mirrors the switch cases in ProductsListView filterRow prop)

type Row = { currency: "USD" | "MMK"; price: string }

function filterRowPrice(r: Row, filterId: string, vals: string[]): boolean {
  const currency = filterId === "priceUSD" ? "USD" : "MMK"
  if (r.currency !== currency) return false
  const min = vals.find((v) => v.startsWith("min:"))?.substring(4)
  const max = vals.find((v) => v.startsWith("max:"))?.substring(4)
  const p = Number(r.price)
  if (min && p < Number(min)) return false
  if (max && p > Number(max)) return false
  return true
}

// ─── Inline the defaultFilters construction logic ──────────
function buildDefaultPriceFilters(opts: {
  priceMinUSD?: string
  priceMaxUSD?: string
  priceMinMMK?: string
  priceMaxMMK?: string
}): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  if (opts.priceMinUSD || opts.priceMaxUSD) {
    out.priceUSD = [
      ...(opts.priceMinUSD ? [`min:${opts.priceMinUSD}`] : []),
      ...(opts.priceMaxUSD ? [`max:${opts.priceMaxUSD}`] : []),
    ]
  }
  if (opts.priceMinMMK || opts.priceMaxMMK) {
    out.priceMMK = [
      ...(opts.priceMinMMK ? [`min:${opts.priceMinMMK}`] : []),
      ...(opts.priceMaxMMK ? [`max:${opts.priceMaxMMK}`] : []),
    ]
  }
  return out
}

describe("filterRow — priceUSD", () => {
  it("passes USD row within both bounds", () => {
    expect(filterRowPrice({ currency: "USD", price: "500" }, "priceUSD", ["min:100", "max:1000"])).toBe(true)
  })

  it("blocks USD row below min", () => {
    expect(filterRowPrice({ currency: "USD", price: "50" }, "priceUSD", ["min:100"])).toBe(false)
  })

  it("blocks USD row above max", () => {
    expect(filterRowPrice({ currency: "USD", price: "2000" }, "priceUSD", ["max:1000"])).toBe(false)
  })

  it("passes USD row when only min is set and price equals min", () => {
    expect(filterRowPrice({ currency: "USD", price: "100" }, "priceUSD", ["min:100"])).toBe(true)
  })

  it("passes USD row when only max is set and price equals max", () => {
    expect(filterRowPrice({ currency: "USD", price: "1000" }, "priceUSD", ["max:1000"])).toBe(true)
  })

  it("blocks MMK row when filtering by USD", () => {
    expect(filterRowPrice({ currency: "MMK", price: "500" }, "priceUSD", ["min:100", "max:1000"])).toBe(false)
  })
})

describe("filterRow — priceMMK", () => {
  it("passes MMK row within both bounds", () => {
    expect(filterRowPrice({ currency: "MMK", price: "500000" }, "priceMMK", ["min:100000", "max:1000000"])).toBe(true)
  })

  it("blocks MMK row below min", () => {
    expect(filterRowPrice({ currency: "MMK", price: "50000" }, "priceMMK", ["min:100000"])).toBe(false)
  })

  it("blocks USD row when filtering by MMK", () => {
    expect(filterRowPrice({ currency: "USD", price: "500000" }, "priceMMK", ["min:100000"])).toBe(false)
  })
})

describe("buildDefaultPriceFilters", () => {
  it("returns empty object when no price params given", () => {
    expect(buildDefaultPriceFilters({})).toEqual({})
  })

  it("builds priceUSD entry with both bounds", () => {
    expect(buildDefaultPriceFilters({ priceMinUSD: "100", priceMaxUSD: "500" })).toEqual({
      priceUSD: ["min:100", "max:500"],
    })
  })

  it("builds priceUSD entry with min only", () => {
    expect(buildDefaultPriceFilters({ priceMinUSD: "100" })).toEqual({
      priceUSD: ["min:100"],
    })
  })

  it("builds priceMMK entry with max only", () => {
    expect(buildDefaultPriceFilters({ priceMaxMMK: "1000000" })).toEqual({
      priceMMK: ["max:1000000"],
    })
  })

  it("builds both currency entries when all four params given", () => {
    expect(
      buildDefaultPriceFilters({
        priceMinUSD: "100",
        priceMaxUSD: "500",
        priceMinMMK: "100000",
        priceMaxMMK: "500000",
      })
    ).toEqual({
      priceUSD: ["min:100", "max:500"],
      priceMMK: ["min:100000", "max:500000"],
    })
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
npm run test:unit -- price-filter
```

Expected: all tests pass (green).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/price-filter.test.ts
git commit -m "test: add unit tests for price filter row logic and defaultFilters construction"
```

---

## Task 7: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open `/admin/products` in the browser**

Navigate to `http://localhost:3000/admin/products`.

- [ ] **Step 3: Verify the filter panel shows USD Price and MMK Price entries**

Click the **Filter** toolbar button. In the left nav of the filter panel, you should see two new entries at the bottom: **USD Price** and **MMK Price**.

- [ ] **Step 4: Test USD price range**

Click **USD Price**. Enter Min: `100`, Max: `10000`. The Filter button badge should show the active filter count. The active bar should show a chip like `USD Price is 100 – 10,000`. The URL should update to include `priceMinUSD=100&priceMaxUSD=10000`. The product list should reload showing only USD products in that range.

- [ ] **Step 5: Test MMK price range**

Click **MMK Price**. Enter a min value. Verify the same chip + URL + reload behavior for MMK products.

- [ ] **Step 6: Test Clear chip**

Click the ✕ on the USD Price chip. The URL param should be removed, the list should reload without the price filter.

- [ ] **Step 7: Test Clear all**

Set both USD and MMK filters. Click **Clear all**. Both price params should disappear from the URL.

- [ ] **Step 8: Test page reload with URL params**

Manually navigate to `http://localhost:3000/admin/products?priceMinUSD=500&priceMaxUSD=5000`. The filter panel should open with USD Price pre-populated (min: 500, max: 5000) and the chip visible in the active bar.
