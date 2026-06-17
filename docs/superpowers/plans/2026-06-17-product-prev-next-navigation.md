# Product Prev/Next Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add context-aware previous/next navigation to the admin product edit form so admins can page through their filtered product list without returning to the list page.

**Architecture:** List context (view tab, search, page, price filters) is encoded in the edit URL when a row is clicked. The edit page server component calls a new `resolveAdjacentProducts` helper that re-runs the same DB query to find the current product's position and computes adjacent hrefs. `ProductForm` renders the nav cluster using those hrefs — all server-side, zero client state, works on direct links.

**Tech Stack:** Next.js 16 App Router (server components), TypeScript, `getAdminProductsFromDb` from Drizzle layer, Vitest + jsdom for tests

## Global Constraints

- `PAGE_SIZE = 25` — must match the list page constant exactly
- Valid view names: `"all" | "pending" | "featured" | "collector" | "sold" | "drafts"` — no other values accepted; invalid values fall back to `"all"`
- Price param keys: `priceMinUSD`, `priceMaxUSD`, `priceMinMMK`, `priceMaxMMK` — same spelling as the list page
- No new npm dependencies
- Nav cluster hidden entirely when no list context params appear in the URL
- Archive view (`?status=archive`) is not carried forward — nav hidden for archive entry points

---

### Task 1: Export `buildEditHref` from ProductsListView and update `onRowClick`

**Files:**
- Modify: `features/products/components/ProductsListView.tsx` — add `buildEditHref` after `buildPageHref` (~line 126); update `onRowClick` at line 522
- Test: `tests/unit/products-build-edit-href.test.ts`

**Interfaces:**
- Produces: `export function buildEditHref(id: string, view: string, search: string | undefined, page: number, priceMinUSD?: string, priceMaxUSD?: string, priceMinMMK?: string, priceMaxMMK?: string): string`

---

- [ ] **Step 1: Write the failing test**

Create `tests/unit/products-build-edit-href.test.ts`:

```ts
import { describe, it, expect } from "vitest"

// ProductsListView is a "use client" module — dynamic import avoids jsdom issues
async function getBuildEditHref() {
  const mod = await import("@/features/products/components/ProductsListView")
  return mod.buildEditHref
}

describe("buildEditHref", () => {
  it("encodes view, search, page, and price params", async () => {
    const buildEditHref = await getBuildEditHref()
    const href = buildEditHref("abc123", "pending", "ruby", 3, "500", "2000", undefined, undefined)
    expect(href).toBe(
      "/admin/products/abc123/edit?view=pending&search=ruby&page=3&priceMinUSD=500&priceMaxUSD=2000"
    )
  })

  it("omits 'view' param when view is 'all'", async () => {
    const buildEditHref = await getBuildEditHref()
    const href = buildEditHref("xyz", "all", undefined, 1)
    expect(href).toBe("/admin/products/xyz/edit?page=1")
  })

  it("trims and omits blank search", async () => {
    const buildEditHref = await getBuildEditHref()
    const href = buildEditHref("xyz", "all", "  ", 1)
    expect(href).toBe("/admin/products/xyz/edit?page=1")
  })

  it("omits undefined price params", async () => {
    const buildEditHref = await getBuildEditHref()
    const href = buildEditHref("xyz", "featured", "gem", 2, undefined, "5000")
    expect(href).toBe("/admin/products/xyz/edit?view=featured&search=gem&page=2&priceMaxUSD=5000")
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:unit -- products-build-edit-href
```

Expected: FAIL — `buildEditHref is not a function` or module export not found

- [ ] **Step 3: Add `buildEditHref` to ProductsListView**

In `features/products/components/ProductsListView.tsx`, add this function after `buildPageHref` (after line ~126):

```ts
export function buildEditHref(
  id: string,
  view: string,
  search: string | undefined,
  page: number,
  priceMinUSD?: string,
  priceMaxUSD?: string,
  priceMinMMK?: string,
  priceMaxMMK?: string,
): string {
  const p = new URLSearchParams()
  if (view !== "all") p.set("view", view)
  if (search?.trim()) p.set("search", search.trim())
  p.set("page", String(page))
  if (priceMinUSD) p.set("priceMinUSD", priceMinUSD)
  if (priceMaxUSD) p.set("priceMaxUSD", priceMaxUSD)
  if (priceMinMMK) p.set("priceMinMMK", priceMinMMK)
  if (priceMaxMMK) p.set("priceMaxMMK", priceMaxMMK)
  return `/admin/products/${id}/edit?${p.toString()}`
}
```

Then replace `onRowClick` (line 522):

```ts
// Before:
onRowClick={(r) => router.push(`/admin/products/${r.id}/edit`)}

// After:
onRowClick={(r) =>
  router.push(
    buildEditHref(r.id, activeView, search, page, priceMinUSD, priceMaxUSD, priceMinMMK, priceMaxMMK)
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm run test:unit -- products-build-edit-href
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add features/products/components/ProductsListView.tsx tests/unit/products-build-edit-href.test.ts
git commit -m "feat: encode list context in product edit row-click URL"
```

---

### Task 2: Create `resolveAdjacentProducts` helper with unit tests

**Files:**
- Create: `app/admin/products/[id]/edit/resolve-adjacent.ts`
- Test: `tests/unit/resolve-adjacent-products.test.ts`

**Interfaces:**
- Consumes: `getAdminProductsFromDb` from `@/features/products/db/products`
- Produces:
  ```ts
  export type ListContext = {
    view?: string; search?: string; page?: string
    priceMinUSD?: string; priceMaxUSD?: string
    priceMinMMK?: string; priceMaxMMK?: string
  }
  export type AdjacentResult = {
    prevHref: string | null; nextHref: string | null
    position: number | null; total: number | null
  }
  export async function resolveAdjacentProducts(id: string, ctx: ListContext): Promise<AdjacentResult>
  ```

---

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/resolve-adjacent-products.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { AdminProductRow } from "@/features/products/db/products"

vi.mock("@/features/products/db/products", () => ({
  getAdminProductsFromDb: vi.fn(),
}))

import { getAdminProductsFromDb } from "@/features/products/db/products"
import { resolveAdjacentProducts } from "@/app/admin/products/[id]/edit/resolve-adjacent"

function makeProducts(ids: string[]): AdminProductRow[] {
  return ids.map((id) => ({ id, title: `P-${id}`, createdAt: new Date() } as AdminProductRow))
}

function mockPage(ids: string[], total = ids.length) {
  return { products: makeProducts(ids), total }
}

beforeEach(() => vi.clearAllMocks())

describe("resolveAdjacentProducts", () => {
  it("returns all null without making DB calls when no context params present", async () => {
    const result = await resolveAdjacentProducts("abc", {})
    expect(result).toEqual({ prevHref: null, nextHref: null, position: null, total: null })
    expect(getAdminProductsFromDb).not.toHaveBeenCalled()
  })

  it("returns all null when product not found in page results", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a", "b"]))
    const result = await resolveAdjacentProducts("z", { page: "1" })
    expect(result).toEqual({ prevHref: null, nextHref: null, position: null, total: null })
  })

  it("mid-page: resolves prev and next from same page without extra DB calls", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a", "b", "c"], 10))
    const result = await resolveAdjacentProducts("b", { page: "1" })
    expect(result.prevHref).toMatch(/\/a\/edit/)
    expect(result.prevHref).toContain("page=1")
    expect(result.nextHref).toMatch(/\/c\/edit/)
    expect(result.nextHref).toContain("page=1")
    expect(result.position).toBe(2)
    expect(result.total).toBe(10)
    expect(getAdminProductsFromDb).toHaveBeenCalledTimes(1)
  })

  it("first item on page 1: prevHref is null, nextHref points to next item", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a", "b"], 5))
    const result = await resolveAdjacentProducts("a", { page: "1" })
    expect(result.prevHref).toBeNull()
    expect(result.nextHref).toMatch(/\/b\/edit/)
    expect(result.position).toBe(1)
  })

  it("first item on page 2: fetches prev page to get last item as prevHref", async () => {
    vi.mocked(getAdminProductsFromDb)
      .mockResolvedValueOnce(mockPage(["c", "d"], 4)) // page 2 (current)
      .mockResolvedValueOnce(mockPage(["a", "b"], 4)) // page 1 (prev)
    const result = await resolveAdjacentProducts("c", { page: "2" })
    expect(result.prevHref).toMatch(/\/b\/edit/)
    expect(result.prevHref).toContain("page=1")
    expect(result.nextHref).toMatch(/\/d\/edit/)
    expect(result.nextHref).toContain("page=2")
  })

  it("last item on page: fetches next page to get first item as nextHref", async () => {
    vi.mocked(getAdminProductsFromDb)
      .mockResolvedValueOnce(mockPage(["a", "b"], 4)) // page 1 (current)
      .mockResolvedValueOnce(mockPage(["c", "d"], 4)) // page 2 (next)
    const result = await resolveAdjacentProducts("b", { page: "1" })
    expect(result.prevHref).toMatch(/\/a\/edit/)
    expect(result.nextHref).toMatch(/\/c\/edit/)
    expect(result.nextHref).toContain("page=2")
  })

  it("last item overall: nextHref is null when next page returns empty", async () => {
    vi.mocked(getAdminProductsFromDb)
      .mockResolvedValueOnce(mockPage(["a", "b"], 2)) // page 1 (current)
      .mockResolvedValueOnce(mockPage([], 2))          // page 2 (empty)
    const result = await resolveAdjacentProducts("b", { page: "1" })
    expect(result.nextHref).toBeNull()
  })

  it("passes moderationStatus filter for 'pending' view", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a"]))
    await resolveAdjacentProducts("a", { view: "pending", page: "1" })
    expect(getAdminProductsFromDb).toHaveBeenCalledWith(
      expect.objectContaining({ moderationStatus: "pending" })
    )
  })

  it("passes isFeatured filter for 'featured' view", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a"]))
    await resolveAdjacentProducts("a", { view: "featured", page: "1" })
    expect(getAdminProductsFromDb).toHaveBeenCalledWith(
      expect.objectContaining({ isFeatured: true })
    )
  })

  it("passes excludeStatuses filter for 'all' view", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a"]))
    await resolveAdjacentProducts("a", { view: "all", page: "1" })
    expect(getAdminProductsFromDb).toHaveBeenCalledWith(
      expect.objectContaining({ excludeStatuses: ["archive"] })
    )
  })

  it("passes search and priceMinUSD as parsed number", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a"]))
    await resolveAdjacentProducts("a", { page: "1", search: "ruby", priceMinUSD: "500" })
    expect(getAdminProductsFromDb).toHaveBeenCalledWith(
      expect.objectContaining({ search: "ruby", priceMinUSD: 500 })
    )
  })

  it("preserves view param in generated hrefs", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a", "b"]))
    const result = await resolveAdjacentProducts("a", { view: "pending", page: "1" })
    expect(result.nextHref).toContain("view=pending")
  })

  it("treats invalid view as 'all'", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a"]))
    await resolveAdjacentProducts("a", { view: "bogus", page: "1" })
    expect(getAdminProductsFromDb).toHaveBeenCalledWith(
      expect.objectContaining({ excludeStatuses: ["archive"] })
    )
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:unit -- resolve-adjacent-products
```

Expected: FAIL — module `resolve-adjacent` not found

- [ ] **Step 3: Create `resolve-adjacent.ts`**

Create `app/admin/products/[id]/edit/resolve-adjacent.ts`:

```ts
import { getAdminProductsFromDb } from "@/features/products/db/products"

const PAGE_SIZE = 25

const VALID_VIEWS = ["all", "pending", "featured", "collector", "sold", "drafts"] as const
type View = (typeof VALID_VIEWS)[number]

function buildViewFilter(view: View) {
  switch (view) {
    case "pending":   return { moderationStatus: "pending" as const }
    case "featured":  return { isFeatured: true as const }
    case "collector": return { isCollectorPiece: true as const }
    case "sold":      return { status: "sold" as const }
    case "drafts":    return { status: "hidden" as const }
    default:          return { excludeStatuses: ["archive"] as const }
  }
}

function parsePrice(raw?: string): number | undefined {
  if (!raw) return undefined
  const n = Number(raw)
  return isFinite(n) && n >= 0 ? n : undefined
}

export type ListContext = {
  view?: string
  search?: string
  page?: string
  priceMinUSD?: string
  priceMaxUSD?: string
  priceMinMMK?: string
  priceMaxMMK?: string
}

export type AdjacentResult = {
  prevHref: string | null
  nextHref: string | null
  position: number | null
  total: number | null
}

function buildAdjacentHref(id: string, ctx: ListContext, page: number): string {
  const p = new URLSearchParams()
  const view = ctx.view ?? "all"
  if (view !== "all") p.set("view", view)
  if (ctx.search?.trim()) p.set("search", ctx.search.trim())
  p.set("page", String(page))
  if (ctx.priceMinUSD) p.set("priceMinUSD", ctx.priceMinUSD)
  if (ctx.priceMaxUSD) p.set("priceMaxUSD", ctx.priceMaxUSD)
  if (ctx.priceMinMMK) p.set("priceMinMMK", ctx.priceMinMMK)
  if (ctx.priceMaxMMK) p.set("priceMaxMMK", ctx.priceMaxMMK)
  return `/admin/products/${id}/edit?${p.toString()}`
}

export async function resolveAdjacentProducts(
  id: string,
  ctx: ListContext,
): Promise<AdjacentResult> {
  const hasContext =
    ctx.view !== undefined ||
    ctx.search !== undefined ||
    ctx.page !== undefined ||
    ctx.priceMinUSD !== undefined ||
    ctx.priceMaxUSD !== undefined ||
    ctx.priceMinMMK !== undefined ||
    ctx.priceMaxMMK !== undefined

  if (!hasContext) {
    return { prevHref: null, nextHref: null, position: null, total: null }
  }

  const page = Math.max(1, parseInt(ctx.page ?? "1", 10) || 1)
  const view: View = (VALID_VIEWS as readonly string[]).includes(ctx.view ?? "")
    ? (ctx.view as View)
    : "all"

  const sharedOpts = {
    limit: PAGE_SIZE,
    search: ctx.search?.trim() || undefined,
    ...buildViewFilter(view),
    priceMinUSD: parsePrice(ctx.priceMinUSD),
    priceMaxUSD: parsePrice(ctx.priceMaxUSD),
    priceMinMMK: parsePrice(ctx.priceMinMMK),
    priceMaxMMK: parsePrice(ctx.priceMaxMMK),
  }

  const { products, total } = await getAdminProductsFromDb({ page, ...sharedOpts })
  const idx = products.findIndex((r) => r.id === id)
  if (idx === -1) return { prevHref: null, nextHref: null, position: null, total: null }

  const position = (page - 1) * PAGE_SIZE + idx + 1

  let prevHref: string | null = null
  if (idx > 0) {
    prevHref = buildAdjacentHref(products[idx - 1].id, ctx, page)
  } else if (page > 1) {
    const { products: prevPage } = await getAdminProductsFromDb({ page: page - 1, ...sharedOpts })
    if (prevPage.length > 0) {
      prevHref = buildAdjacentHref(prevPage[prevPage.length - 1].id, ctx, page - 1)
    }
  }

  let nextHref: string | null = null
  if (idx < products.length - 1) {
    nextHref = buildAdjacentHref(products[idx + 1].id, ctx, page)
  } else {
    const { products: nextPage } = await getAdminProductsFromDb({ page: page + 1, ...sharedOpts })
    if (nextPage.length > 0) {
      nextHref = buildAdjacentHref(nextPage[0].id, ctx, page + 1)
    }
  }

  return { prevHref, nextHref, position, total }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:unit -- resolve-adjacent-products
```

Expected: PASS — 12 tests

- [ ] **Step 5: Commit**

```bash
git add app/admin/products/[id]/edit/resolve-adjacent.ts tests/unit/resolve-adjacent-products.test.ts
git commit -m "feat: add resolveAdjacentProducts helper for product edit navigation"
```

---

### Task 3: Wire the edit page — extend searchParams and pass adjacent props to ProductForm

**Files:**
- Modify: `app/admin/products/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `resolveAdjacentProducts`, `ListContext`, `AdjacentResult` from `./resolve-adjacent`
- Produces: passes `prevHref`, `nextHref`, `listPosition`, `listTotal` down to `<ProductForm>` (TypeScript will error on the ProductForm props until Task 4 adds them — that is expected)

No separate unit test — this is thin wiring; the helper is tested in Task 2 and the UI is tested in Task 4.

---

- [ ] **Step 1: Replace the edit page**

Replace the entire content of `app/admin/products/[id]/edit/page.tsx`:

```ts
import { connection } from "next/server"
import { notFound } from "next/navigation"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ProductForm } from "@/features/products/components/ProductForm"
import { getCachedProduct } from "@/features/products/db/cache/products"
import { getAllCategories } from "@/features/categories/db/categories"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"
import { getAllOrigins } from "@/features/origin/db/origin"
import { getFeatureSettings } from "@/features/points/db/points"
import { FadeUp } from "@/components/admin/motion"
import { resolveAdjacentProducts } from "./resolve-adjacent"

const BACK_ROUTES: Record<string, { href: string; label: string }> = {
  "collector-requests": {
    href: "/admin/collector-piece-show-requests",
    label: "Collector Requests",
  },
}

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    from?: string
    view?: string
    search?: string
    page?: string
    priceMinUSD?: string
    priceMaxUSD?: string
    priceMinMMK?: string
    priceMaxMMK?: string
  }>
}

export default async function AdminProductsEditPage({ params, searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.PRODUCTS)
  const { id } = await params
  const sp = await searchParams
  const back = sp.from ? (BACK_ROUTES[sp.from] ?? null) : null

  const [product, categories, laboratories, origins, featureSettings, adjacent] = await Promise.all([
    getCachedProduct(id),
    getAllCategories(),
    getAllLaboratories(),
    getAllOrigins(),
    getFeatureSettings(),
    resolveAdjacentProducts(id, {
      view: sp.view,
      search: sp.search,
      page: sp.page,
      priceMinUSD: sp.priceMinUSD,
      priceMaxUSD: sp.priceMaxUSD,
      priceMinMMK: sp.priceMinMMK,
      priceMaxMMK: sp.priceMaxMMK,
    }),
  ])

  if (!product) notFound()

  return (
    <FadeUp>
      <div className="py-2">
        <ProductForm
          key={product.id}
          mode="edit"
          product={product}
          categories={categories}
          laboratories={laboratories}
          origins={origins}
          featurePricingTiers={featureSettings.pricingTiers}
          backHref={back?.href}
          backLabel={back?.label}
          prevHref={adjacent.prevHref}
          nextHref={adjacent.nextHref}
          listPosition={adjacent.position}
          listTotal={adjacent.total}
        />
      </div>
    </FadeUp>
  )
}
```

- [ ] **Step 2: Check TypeScript (expect ProductForm prop errors — fix in Task 4)**

```bash
npx tsc --noEmit 2>&1 | grep -i "prevHref\|nextHref\|listPosition\|listTotal"
```

Expected: errors about unknown props on `ProductForm` — these are resolved in Task 4.

- [ ] **Step 3: Commit**

```bash
git add app/admin/products/[id]/edit/page.tsx
git commit -m "feat: wire resolveAdjacentProducts into product edit page"
```

---

### Task 4: Add prev/next nav cluster to ProductForm

**Files:**
- Modify: `features/products/components/ProductForm.tsx` — extend `Props` type and destructure (~line 312); add nav cluster in topbar (~line 684)
- Modify: `app/admin-list-view.css` — add `.pd-listnav`, `.pd-listnav-btn`, `.pd-listnav-count` styles after line 1818
- Test: `tests/component/product-form-nav.test.tsx`

**Interfaces:**
- Consumes: `prevHref?: string | null`, `nextHref?: string | null`, `listPosition?: number | null`, `listTotal?: number | null` added to `Props`

---

- [ ] **Step 1: Write the failing component test**

Create `tests/component/product-form-nav.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ProductForm } from "@/features/products/components/ProductForm"
import type { ProductForEdit } from "@/features/products/db/products"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/products/actions/products", () => ({
  createProductAction: vi.fn(),
  updateProductAction: vi.fn(),
}))

const minProduct = {
  id: "prod-1",
  title: "Test Gem",
  productType: "loose_stone",
  status: "active",
  moderationStatus: "approved",
  isFeatured: false,
  isCollectorPiece: false,
  isPrivilegeAssist: false,
  isPromotion: false,
  isNegotiable: false,
  price: "100",
  currency: "USD",
  imageUrls: [],
  videoUrls: [],
  sellerId: "seller-1",
  sellerName: "Test Seller",
  createdAt: new Date("2026-01-01"),
} as unknown as ProductForEdit

describe("ProductForm nav cluster", () => {
  it("renders prev and next links when both hrefs provided", () => {
    render(
      <ProductForm
        mode="edit"
        product={minProduct}
        categories={[]}
        prevHref="/admin/products/prev-id/edit?page=1"
        nextHref="/admin/products/next-id/edit?page=1"
        listPosition={5}
        listTotal={20}
      />
    )
    const prevLink = screen.getByRole("link", { name: /previous product/i })
    const nextLink = screen.getByRole("link", { name: /next product/i })
    expect(prevLink).toHaveAttribute("href", "/admin/products/prev-id/edit?page=1")
    expect(nextLink).toHaveAttribute("href", "/admin/products/next-id/edit?page=1")
    expect(screen.getByText("5 / 20")).toBeInTheDocument()
  })

  it("omits prev link at list start, shows next link", () => {
    render(
      <ProductForm
        mode="edit"
        product={minProduct}
        categories={[]}
        prevHref={null}
        nextHref="/admin/products/next-id/edit?page=1"
        listPosition={1}
        listTotal={10}
      />
    )
    expect(screen.queryByRole("link", { name: /previous product/i })).toBeNull()
    expect(screen.getByRole("link", { name: /next product/i })).toBeInTheDocument()
  })

  it("omits next link at list end, shows prev link", () => {
    render(
      <ProductForm
        mode="edit"
        product={minProduct}
        categories={[]}
        prevHref="/admin/products/prev-id/edit?page=1"
        nextHref={null}
        listPosition={10}
        listTotal={10}
      />
    )
    expect(screen.getByRole("link", { name: /previous product/i })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /next product/i })).toBeNull()
  })

  it("hides nav cluster entirely when no list context props passed", () => {
    render(<ProductForm mode="edit" product={minProduct} categories={[]} />)
    expect(screen.queryByRole("link", { name: /previous product/i })).toBeNull()
    expect(screen.queryByRole("link", { name: /next product/i })).toBeNull()
    expect(screen.queryByText(/\d+ \/ \d+/)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:component -- product-form-nav
```

Expected: FAIL — `prevHref` prop not accepted; nav cluster not in DOM

- [ ] **Step 3: Extend Props in ProductForm**

In `features/products/components/ProductForm.tsx`, update the `Props` type (around line 312):

```ts
type Props = {
  mode: "create" | "edit"
  product?: ProductForEdit | null
  categories: CategoryRow[]
  laboratories?: LaboratoryOption[] | null
  origins?: OriginOption[] | null
  featurePricingTiers?: FeaturePricingTier[] | null
  backHref?: string | null
  backLabel?: string | null
  prevHref?: string | null
  nextHref?: string | null
  listPosition?: number | null
  listTotal?: number | null
}
```

Update the destructure in `export function ProductForm({...}: Props)` (around line 323):

```ts
export function ProductForm({
  mode,
  product,
  categories,
  laboratories,
  origins,
  featurePricingTiers,
  backHref,
  backLabel = "Back",
  prevHref,
  nextHref,
  listPosition,
  listTotal,
}: Props) {
```

- [ ] **Step 4: Add the nav cluster to the topbar**

In `features/products/components/ProductForm.tsx`, find the topbar section. The breadcrumb `</nav>` closes and is followed by `<div className="pd-topbar-spacer" />`. Insert the nav cluster between them:

```tsx
          {/* Before pd-topbar-spacer, after the closing </nav> of pd-breadcrumbs */}
          {(prevHref != null || nextHref != null || listPosition != null) && (
            <div className="pd-listnav">
              {prevHref ? (
                <Link href={prevHref} className="pd-listnav-btn" aria-label="Previous product">
                  <ChevronLeft size={14} />
                </Link>
              ) : (
                <span className="pd-listnav-btn" style={{ opacity: 0.25 }} aria-hidden="true">
                  <ChevronLeft size={14} />
                </span>
              )}
              {listPosition != null && listTotal != null && (
                <span className="pd-listnav-count">{listPosition} / {listTotal}</span>
              )}
              {nextHref ? (
                <Link href={nextHref} className="pd-listnav-btn" aria-label="Next product">
                  <ChevronRight size={14} />
                </Link>
              ) : (
                <span className="pd-listnav-btn" style={{ opacity: 0.25 }} aria-hidden="true">
                  <ChevronRight size={14} />
                </span>
              )}
            </div>
          )}
```

- [ ] **Step 5: Add CSS for the nav cluster**

In `app/admin-list-view.css`, after the `.pd-breadcrumbs .pd-here` rule (after line 1818), add:

```css
.pd-listnav {
  display: flex; align-items: center; gap: 2px;
}
.pd-listnav-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  color: var(--lv-text-2); text-decoration: none; cursor: pointer;
  transition: background .12s;
}
.pd-listnav-btn:hover { background: var(--lv-panel-2); }
.pd-listnav-count {
  font-size: 12px; color: var(--lv-text-3);
  padding: 0 4px; font-variant-numeric: tabular-nums; white-space: nowrap;
}
```

- [ ] **Step 6: Run the component tests**

```bash
npm run test:component -- product-form-nav
```

Expected: PASS — 4 tests

- [ ] **Step 7: Verify TypeScript is clean**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 8: Run full test suite**

```bash
npm run test
```

Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add features/products/components/ProductForm.tsx app/admin-list-view.css tests/component/product-form-nav.test.tsx
git commit -m "feat: add prev/next navigation cluster to product edit form"
```

---

## Self-Review

**Spec coverage:**
- ✅ List context encoded in row-click URL — Task 1
- ✅ `resolveAdjacentProducts` with all 6 view filters — Task 2
- ✅ Cross-page boundary (fetch adjacent page) — Task 2, tests cover first-on-page-N and last-on-page-N cases
- ✅ Product not found in results → nav hidden — Task 2 test
- ✅ No list context → nav hidden, no DB call — Task 2 test + Task 4 test
- ✅ Edit page wiring with `Promise.all` — Task 3
- ✅ Nav cluster with prev/next links and disabled spans at boundaries — Task 4
- ✅ Position counter `x / total` — Task 4 test
- ✅ Archive view not carried forward — `buildEditHref` doesn't encode `status=archive`, so resolver sees no archive context and returns null, nav hidden
- ✅ CSS styles added to existing `pd-` block in `admin-list-view.css` — Task 4 Step 5

**Placeholder scan:** No TBDs. All code blocks are complete and self-contained.

**Type consistency:**
- `prevHref`/`nextHref`/`listPosition`/`listTotal` defined in Task 4 `Props` match exactly what Task 3 passes from `adjacent`
- `resolveAdjacentProducts` return type `AdjacentResult` has `position`/`total` which Task 3 maps to `listPosition`/`listTotal`
- `buildAdjacentHref` (internal to Task 2) and `buildEditHref` (Task 1, exported) both produce the same URL shape — verified by test expectations ✅
