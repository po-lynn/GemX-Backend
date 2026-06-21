# Implementation Plan: Portal Products List View
Date: 2026-06-21
Spec: `docs/superpowers/specs/2026-06-21-portal-products-list-design.md`

## Phase 0: Confirmed APIs (Documentation Discovery)

All patterns sourced from existing files — no invented APIs.

### Allowed patterns
| Pattern | Source |
|---------|--------|
| `"use cache"` + `cacheTag(getProductsGlobalTag())` | `features/products/db/cache/products.ts:56-57` |
| `sql<number>\`count(*) filter (where ...)\`\` | `features/products/db/products.ts:1150-1155` |
| `eq(product.sellerId, sellerId)` as `.where()` arg | `features/products/db/products.ts:439` |
| `requireActionRole((role) => role === "portal")` | `features/products/actions/portal-products.ts:17` |
| `revalidateProductsCache()` (no args = global) | `features/products/actions/portal-products.ts:41` |
| `db.delete(product).where(and(...))` | `features/products/db/products.ts:1131-1137` |
| `inArray(product.id, ids)` | `features/products/actions/products.ts:343` |
| `ListViewCard` props contract | `components/admin/list-view/types.ts:3-65` |
| `AdminProductRow` type | `features/products/db/products.ts:96-125` |
| `buildEditHref` / `buildViewHref` / `buildPageHref` pattern | `features/products/components/ProductsListView.tsx:100-147` |

### Anti-patterns
- Do NOT use `bulkSetProductModeration` in portal (admin-only action)
- Do NOT import `canAdminManageProducts` in portal actions — use role check `(role) => role === "portal"` 
- Do NOT pass `sellerId` to `getAdminProductCounts` — it has no seller param; use the new portal function

---

## Phase 1: DB Layer — Portal Product Counts

**Goal:** Add seller-scoped count function to DB layer + cache layer.

### Task 1.1 — Add `getPortalProductCountsFromDb(sellerId)` to `features/products/db/products.ts`

Mirror `getAdminProductCountsFromDb` (lines 1140–1159) but add `.where(eq(product.sellerId, sellerId))`.

```typescript
// Add after getAdminProductCountsFromDb (after line 1159)
export async function getPortalProductCountsFromDb(sellerId: string): Promise<{
  all: number
  pending: number
  featured: number
  collector: number
  sold: number
  drafts: number
}> {
  const [row] = await db
    .select({
      all:       sql<number>`count(*) filter (where ${product.status} != 'archive')::int`,
      pending:   sql<number>`count(*) filter (where ${product.moderationStatus} = 'pending' and ${product.status} != 'archive')::int`,
      featured:  sql<number>`count(*) filter (where ${product.isFeatured} = true and ${product.status} != 'archive')::int`,
      collector: sql<number>`count(*) filter (where ${product.isCollectorPiece} = true and ${product.status} != 'archive')::int`,
      sold:      sql<number>`count(*) filter (where ${product.status} = 'sold')::int`,
      drafts:    sql<number>`count(*) filter (where ${product.status} = 'hidden')::int`,
    })
    .from(product)
    .where(eq(product.sellerId, sellerId))
  return row ?? { all: 0, pending: 0, featured: 0, collector: 0, sold: 0, drafts: 0 }
}
```

### Task 1.2 — Add `getPortalProductCounts(sellerId)` to `features/products/db/cache/products.ts`

Add import for `getPortalProductCountsFromDb`, then add cached wrapper mirroring `getAdminProductCounts` (lines 94–98).

```typescript
// Add to imports at top
import { getPortalProductCountsFromDb } from "../products"

// Add after getAdminProductCounts
export async function getPortalProductCounts(sellerId: string): Promise<{
  all: number
  pending: number
  featured: number
  collector: number
  sold: number
  drafts: number
}> {
  "use cache"
  cacheTag(getProductsGlobalTag())
  return getPortalProductCountsFromDb(sellerId)
}
```

### Verification
- `grep -n "getPortalProductCounts" features/products/db/cache/products.ts` → finds the function
- `grep -n "getPortalProductCountsFromDb" features/products/db/products.ts` → finds the function
- TypeScript check: `npx tsc --noEmit` passes

---

## Phase 2: Server Action — Bulk Delete Portal Products

**Goal:** Add `bulkDeletePortalProductAction` to `features/products/actions/portal-products.ts`.

Use a single `db.delete` with `and(inArray(product.id, ids), eq(product.sellerId, session.user.id))` — ownership enforced in the WHERE clause (safer + single round-trip vs. loop).

**Return type** matches existing `ActionResult`: `{ ok: true; deleted: number } | { ok: false; error: string }`.

```typescript
// Add after deletePortalProductAction (after line 86)
export async function bulkDeletePortalProductAction(
  ids: string[]
): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  if (!ids.length) return { ok: false, error: "No products selected" }

  const session = await requireActionRole((role) => role === "portal")
  if (!session) return { ok: false, error: "Unauthorized" }

  const result = await db
    .delete(product)
    .where(and(inArray(product.id, ids), eq(product.sellerId, session.user.id)))
    .returning({ id: product.id })

  revalidateProductsCache()
  return { ok: true, deleted: result.length }
}
```

**Required imports to add:** `inArray`, `and` from `drizzle-orm`; `product` from `@/drizzle/schema/product-schema`; `db` from `@/drizzle/db`.

### Verification
- `grep -n "bulkDeletePortalProductAction" features/products/actions/portal-products.ts` → found
- Ownership is enforced by the WHERE clause (no separate fetch needed)
- TypeScript check passes

---

## Phase 3: `PortalProductsListView` Component

**Goal:** Create `features/products/components/PortalProductsListView.tsx` — a portal-scoped sibling of `ProductsListView.tsx`.

**Copy base from:** `features/products/components/ProductsListView.tsx` (full file, 585 lines)

**Modifications from the copy:**

### 3.1 — Change BASE URL
```typescript
// Change line 100
const BASE = "/portal/products"
```

### 3.2 — Remove Seller column
Delete the entire `seller` column definition (lines 317–332 in ProductsListView.tsx). Resulting columns: product, type, price, status, review, flags, createdAt.

### 3.3 — Rename "Moderation" → "Review"
```typescript
// Change column id from "moderation" to "review", label from "Moderation" to "Review"
{
  id: "review",
  label: "Review",
  width: 120,
  sortable: true,
  render: (r) => <ProductStatusPill status={r.moderationStatus} />,
},
```

### 3.4 — Remove Seller filter + group
- Remove the `moderation` filter def (keep it but rename label to "Review")
- Remove `{ id: "seller", label: "Seller" }` from `groupOptions`
- Remove `case "seller"` from `getGroupKey`

### 3.5 — Change bulk actions (Archive + Delete, no Approve/Reject)
Replace the `renderBulkActions` prop content:

```typescript
renderBulkActions={(rows, onClear) => {
  const ids = rows.map((r) => r.id)
  return (
    <>
      <button
        className="lv-bulkbtn"
        disabled={isPending}
        onClick={() => runBulk("archive", () => bulkSetProductStatus(ids, "archive"), onClear, ids.length)}
      >
        <Archive /> {pendingAction === "archive" ? "Archiving…" : "Archive"}
      </button>
      <button
        className="lv-bulkbtn lv-bulkbtn-danger"
        disabled={isPending}
        onClick={() => runBulk("delete", () => bulkDeletePortalProductAction(ids), onClear, ids.length)}
      >
        <Trash2 /> {pendingAction === "delete" ? "Deleting…" : "Delete"}
      </button>
    </>
  )
}}
```

### 3.6 — Update imports
- Remove: `bulkSetProductModeration` import
- Add: `bulkDeletePortalProductAction` from `@/features/products/actions/portal-products`
- Add: `Trash2` from `lucide-react`
- Keep: `bulkSetProductStatus`, `Archive`

### 3.7 — Update `runBulk` success map
Add a "delete" entry:
```typescript
delete: { title: `${n} product${n > 1 ? "s" : ""} deleted`, description: "Products removed from your listings." },
```

### 3.8 — Update `getSortValue` for renamed column
```typescript
case "review": return r.moderationStatus
// (was "moderation")
```

### 3.9 — Export from index
Add to `features/products/components/index.ts`:
```typescript
export { PortalProductsListView } from "./PortalProductsListView"
```

### Verification
- `grep -n "bulkDeletePortalProductAction" features/products/components/PortalProductsListView.tsx` → found
- `grep -n "Seller\|seller" features/products/components/PortalProductsListView.tsx` → no results
- `grep -n "BASE" features/products/components/PortalProductsListView.tsx` → shows `/portal/products`
- TypeScript check passes

---

## Phase 4: Page Rewrite + Layout Width

### Task 4.1 — Rewrite `app/portal/products/page.tsx`

Replace the entire file. Model after `app/admin/products/page.tsx` (lines 1–130) with portal adjustments:

```typescript
import { connection } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import Link from "next/link"
import { Plus } from "lucide-react"
import { getPortalProductCounts } from "@/features/products/db/cache/products"
import { getProductsBySellerId } from "@/features/products/db/products"
import { PortalProductsListView } from "@/features/products/components"
import type { ViewTab } from "@/components/admin/list-view"

const PAGE_SIZE = 25
const VIEWS = ["all", "pending", "featured", "collector", "sold", "drafts"] as const
type View = (typeof VIEWS)[number]

type Props = {
  searchParams: Promise<{
    page?: string
    view?: string
    search?: string
    priceMinUSD?: string
    priceMaxUSD?: string
    priceMinMMK?: string
    priceMaxMMK?: string
  }>
}

export default async function PortalProductsPage({ searchParams }: Props) {
  await connection()
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session!.user.id
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const search = params.search?.trim() || undefined
  const view: View = (VIEWS as readonly string[]).includes(params.view ?? "")
    ? (params.view as View)
    : "all"

  function parsePrice(raw: string | undefined): number | undefined {
    if (!raw) return undefined
    const n = Number(raw)
    return isFinite(n) && n >= 0 ? n : undefined
  }

  const priceMinUSD = parsePrice(params.priceMinUSD)
  const priceMaxUSD = parsePrice(params.priceMaxUSD)
  const priceMinMMK = parsePrice(params.priceMinMMK)
  const priceMaxMMK = parsePrice(params.priceMaxMMK)

  const viewFilter = {
    all:       {},
    pending:   { moderationStatus: "pending" as const },
    featured:  { isFeatured: true },
    collector: { isCollectorPiece: true },
    sold:      { status: "sold" as const },
    drafts:    { status: "hidden" as const },
  }[view]

  const [counts, { products, total }] = await Promise.all([
    getPortalProductCounts(userId),
    getProductsBySellerId(userId, {
      page,
      limit: PAGE_SIZE,
      search,
      ...viewFilter,
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
  ])

  const views: ViewTab[] = [
    { id: "all",       label: "All",       count: counts.all },
    { id: "pending",   label: "Pending",   count: counts.pending },
    { id: "featured",  label: "Featured",  count: counts.featured },
    { id: "collector", label: "Collector", count: counts.collector },
    { id: "sold",      label: "Sold",      count: counts.sold },
    { id: "drafts",    label: "Drafts",    count: counts.drafts },
  ]

  return (
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <h1 className="lv-h1">
            My Products
            <span className="lv-h1-count">{counts.all.toLocaleString()} total</span>
          </h1>
          <p className="lv-subhead">Manage your gemstone &amp; jewellery listings.</p>
        </div>
        <div className="lv-pagehead-actions">
          <Link href="/portal/products/new" className="lv-new-btn">
            <Plus /> New Product
          </Link>
        </div>
      </div>

      <PortalProductsListView
        products={products}
        views={views}
        activeView={view}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        search={search}
        priceMinUSD={priceMinUSD !== undefined ? String(priceMinUSD) : undefined}
        priceMaxUSD={priceMaxUSD !== undefined ? String(priceMaxUSD) : undefined}
        priceMinMMK={priceMinMMK !== undefined ? String(priceMinMMK) : undefined}
        priceMaxMMK={priceMaxMMK !== undefined ? String(priceMaxMMK) : undefined}
      />
    </div>
  )
}
```

**Note:** No price filter params are passed to `getProductsBySellerId` here — price filtering happens client-side within `ListViewCard` (same as admin). The `priceMin/Max` props are passed to `PortalProductsListView` to initialize the filter UI state.

### Task 4.2 — Portal layout width

Edit `app/portal/layout.tsx` line 19:
```typescript
// Before
<main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
// After
<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
```

### Verification
- `curl -s http://localhost:3000/portal/products` returns 200
- Tab counts match expected (All = total seller products)
- Seller column absent from table
- "+ New Product" button links to `/portal/products/new`

---

## Phase 5: Verification

1. **TypeScript:** `npx tsc --noEmit` — zero errors
2. **Lint:** `npm run lint` — zero errors
3. **Build:** `npm run build` — completes without errors
4. **Runtime checks:**
   - Navigate to `/portal/products` — full list view renders (tabs, search, filter, sort)
   - Switch tabs (All / Pending / Featured / etc.) — URL updates, counts match
   - Click a row — navigates to `/portal/products/{id}/edit`
   - Select rows → bulk toolbar appears with Archive + Delete buttons
   - Archive bulk → products disappear from active view, toast appears
   - Delete bulk → products removed, toast appears
   - Search → debounced URL push, results filter
   - "+ New Product" → navigates to `/portal/products/new`
5. **Security check:** `grep -n "sellerId" features/products/actions/portal-products.ts` — `bulkDeletePortalProductAction` WHERE clause includes `eq(product.sellerId, session.user.id)`
