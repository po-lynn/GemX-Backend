# Portal Products List View — Design Spec
Date: 2026-06-21

## Goal
Replace the simple card list at `/portal/products` with the full enterprise list-view UI from `/admin/products` — same tabs, filters, search, sort, grouping, and pagination — scoped to the current seller's own products. No sidebar, no admin-only actions (approve/reject).

## Files Changed

| File | Action |
|------|--------|
| `features/products/db/cache/products.ts` | Add `getPortalProductCounts(sellerId)` |
| `features/products/components/PortalProductsListView.tsx` | New client component |
| `features/products/components/index.ts` | Export new component |
| `app/portal/products/page.tsx` | Rewrite — use new list view |
| `app/portal/layout.tsx` | Change `max-w-5xl` → `max-w-7xl` |

## 1. `getPortalProductCounts(sellerId)`

New cached function in `features/products/db/cache/products.ts`. Returns `{ all, pending, featured, collector, sold, drafts }` — same shape as `getAdminProductCounts` but every sub-query is filtered by `sellerId`.

- `all`: all products for seller (no status exclusion, raw total)
- `pending`: where `moderationStatus = 'pending'`
- `featured`: where `isFeatured = true`
- `collector`: where `isCollectorPiece = true`
- `sold`: where `status = 'sold'`
- `drafts`: where `status = 'hidden'`

Uses `"use cache"` + `cacheTag(getProductsGlobalTag())` like other functions in that file.

## 2. `PortalProductsListView` component

`features/products/components/PortalProductsListView.tsx` — client component, mirrors `ProductsListView` with these portal-specific differences:

### Columns (7 total, no Seller)
| id | label | width | notes |
|----|-------|-------|-------|
| product | Product | flex | image + title + short id (same as admin) |
| type | Type | 190 | category + loose stone / jewellery icon |
| price | Price | 130 | right-aligned, promo compare price |
| status | Status | 110 | same `ProductStatusPill` |
| review | Review | 120 | moderation status, seller-friendly label ("Review") |
| flags | Flags | 190 | Featured / Collector / Privilege / Promo badges |
| createdAt | Created | 140 | date + relative time |

### Tabs (same as admin)
All · Pending · Featured · Collector · Sold · Drafts

### Filters
type, category, status, review (moderation), flags, createdAt, price — identical logic to admin, "Moderation" filter renamed "Review".

### Group options
type, category, status, review, visibility — Seller removed.

### Bulk actions
- **Archive** — calls `bulkSetProductStatus(ids, "archive")` (existing server action)
- **Delete** — new `bulkDeletePortalProducts(ids)` server action (loops `deleteProductInDb`, checks `sellerId` ownership before each delete)

### URL base
`/portal/products` (replaces `/admin/products` in all `buildViewHref` / `buildPageHref` / `buildEditHref` calls).

### Row click
Navigates to `/portal/products/${id}/edit` with list-context params preserved.

## 3. `app/portal/products/page.tsx` rewrite

Server component. Same structure as admin page:
- Read search params: `page`, `view`, `search`, `priceMinUSD`, `priceMaxUSD`, `priceMinMMK`, `priceMaxMMK`
- `view` options: `all | pending | featured | collector | sold | drafts`
- `viewFilter` map identical to admin
- Fetch in parallel: `getPortalProductCounts(userId)` + `getProductsBySellerId(userId, { page, limit: 25, search, ...viewFilter, priceFilters })`
- Header: "My Products" title + count, subtitle "Manage your gemstone & jewellery listings.", "+ New Product" button
- No breadcrumbs (portal has no admin nav context)

## 4. Portal layout width

`app/portal/layout.tsx`: change `max-w-5xl` → `max-w-7xl` so the 7-column table has room to breathe. All portal pages (home, edit, new) benefit from the extra width.

## 5. New server action: `bulkDeletePortalProducts`

`features/products/actions/portal-products.ts`. Takes `ids: string[]`, requires portal session, iterates each id: fetch product, verify `sellerId === session.user.id`, call `deleteProductInDb`. Returns `{ ok: true; deleted: number } | { ok: false; error: string }`. Calls `revalidateProductsCache` for each deleted id.

## Out of scope
- Export Excel
- Approve / Reject
- Seller column
- Moderation actions of any kind
