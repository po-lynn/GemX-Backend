# Product Prev/Next Navigation — Design Spec

**Date:** 2026-06-17  
**Feature:** Context-aware previous/next navigation on the admin product edit form

---

## Goal

Allow admins to page through products sequentially from the edit form without returning to the list. Navigation preserves the active filter context (view tab, search query, price filters).

---

## Approach

Pass the active list params in the edit URL when a row is clicked. The edit page server component re-runs the same DB query to find the current product's position and resolves the adjacent product IDs server-side. No client state, no sessionStorage. Works on direct links and page refresh.

---

## URL Structure

Row clicks in `ProductsListView` navigate to:

```
/admin/products/[id]/edit?view=pending&search=ruby&page=2&priceMinUSD=500
```

Params carried forward: `view`, `search`, `page`, `priceMinUSD`, `priceMaxUSD`, `priceMinMMK`, `priceMaxMMK`.

When no list context is present (direct link, old bookmark), the nav buttons are simply hidden.

---

## Files Changed

### 1. `features/products/components/ProductsListView.tsx`

**Line 522** — `onRowClick` currently pushes a bare edit URL. Change to build a URL that includes the active list params:

```ts
onRowClick={(r) => {
  const p = new URLSearchParams()
  if (activeView !== "all") p.set("view", activeView)
  if (search?.trim()) p.set("search", search.trim())
  p.set("page", String(page))
  for (const [k, v] of [
    ["priceMinUSD", priceMinUSD],
    ["priceMaxUSD", priceMaxUSD],
    ["priceMinMMK", priceMinMMK],
    ["priceMaxMMK", priceMaxMMK],
  ] as const) {
    if (v) p.set(k, v)
  }
  router.push(`/admin/products/${r.id}/edit?${p.toString()}`)
}}
```

No other changes to this file.

---

### 2. `app/admin/products/[id]/edit/page.tsx`

**`searchParams` type** grows to accept the list context params:

```ts
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
```

**New helper** `resolveAdjacentProducts` (defined in the same file, not exported):

```ts
async function resolveAdjacentProducts(
  id: string,
  raw: { view?: string; search?: string; page?: string; priceMinUSD?: string; priceMaxUSD?: string; priceMinMMK?: string; priceMaxMMK?: string }
): Promise<{ prevHref: string | null; nextHref: string | null; position: number | null; total: number | null }>
```

Logic:
1. Parse `page` (default 1), `view` (validate against allowed list, default `"all"`), price params.
2. Build `viewFilter` using the same mapping as `app/admin/products/page.tsx`:
   ```ts
   const VIEW_FILTERS = {
     all:       { excludeStatuses: ["archive"] as const },
     pending:   { moderationStatus: "pending" as const },
     featured:  { isFeatured: true },
     collector: { isCollectorPiece: true },
     sold:      { status: "sold" as const },
     drafts:    { status: "hidden" as const },
   }
   ```
3. Call `getAdminProductsFromDb({ page, limit: 25, search, ...viewFilter, priceMinUSD, ... })`.
4. Find `idx = results.findIndex(r => r.id === id)`.  
   - If `idx === -1`: product not in this page (product status changed, stale URL) → return all nulls.
5. Compute `globalPosition = (page - 1) * 25 + idx + 1`.
6. **Prev:**
   - `idx > 0` → `prevId = results[idx - 1].id`, `prevPage = page`
   - `idx === 0 && page > 1` → fetch page `page - 1` (same opts), `prevId = last item`, `prevPage = page - 1`
   - Otherwise → no prev
7. **Next:**
   - `idx < results.length - 1` → `nextId = results[idx + 1].id`, `nextPage = page`
   - `idx === results.length - 1` → fetch page `page + 1` (same opts), `nextId = first item if exists`, `nextPage = page + 1`
   - Otherwise → no next
8. Build hrefs by cloning the incoming raw params and setting `page` to the resolved page number.
9. Return `{ prevHref, nextHref, position: globalPosition, total }`.

The page passes the result to `ProductForm` as new props.

**Performance note:** At most 2 DB calls (current page + one adjacent page). The `getCachedProduct` call for the product itself remains unchanged.

---

### 3. `features/products/components/ProductForm.tsx`

**Props** — add four optional fields:

```ts
prevHref?: string | null
nextHref?: string | null
listPosition?: number | null
listTotal?: number | null
```

**UI** — in the `pd-topbar`, between the breadcrumb `<nav>` and the `pd-topbar-spacer`, add a nav cluster when any of the new props are set:

```tsx
{(prevHref || nextHref || listPosition) && (
  <div className="pd-listnav">
    {prevHref
      ? <Link href={prevHref} className="pd-listnav-btn" aria-label="Previous product"><ChevronLeft size={14} /></Link>
      : <span className="pd-listnav-btn" aria-disabled="true"><ChevronLeft size={14} /></span>}
    {listPosition && listTotal && (
      <span className="pd-listnav-count">{listPosition} / {listTotal}</span>
    )}
    {nextHref
      ? <Link href={nextHref} className="pd-listnav-btn" aria-label="Next product"><ChevronRight size={14} /></Link>
      : <span className="pd-listnav-btn" aria-disabled="true"><ChevronRight size={14} /></span>}
  </div>
)}
```

Styling (inline or via existing CSS pattern): buttons are small icon buttons with hover state; the disabled span is faded (`opacity: 0.3`). The cluster sits between the breadcrumb and the spacer, left-aligned.

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Direct link / no list context params | Nav cluster hidden entirely |
| Product not found in page (status changed, stale filter) | Nav cluster hidden |
| First product in list (page 1, index 0) | Prev button disabled |
| Last product in list | Next button disabled |
| Cross-page boundary (last on page N → first on page N+1) | Page param incremented in href |
| Archive view (`?status=archive`) | Not carried forward — archive uses a different URL shape; nav hidden for archive entry points |

---

## Out of Scope

- Keyboard shortcuts (← →) for prev/next
- Preloading adjacent products
- Showing the adjacent product title on hover
