# Admin List View System

Technical reference for the `ListViewCard` component system and the Credit Purchase Requests admin page.

---

## Overview

The admin list view system is a reusable set of components that power data-table pages in the admin panel. It is used by:

- `/admin/credit/premium-dealer-subscriptions`
- `/admin/credit/purchase-requests`

Both pages share the same shell (`ListViewCard`) and add page-specific column definitions, filter logic, and row actions on top.

---

## Component Architecture

```
app/admin/credit/purchase-requests/page.tsx   ← Server component (data fetching)
  └── PointPurchaseRequestsTable.tsx           ← Client component (state + actions)
        └── ListViewCard                        ← Generic orchestrator
              ├── Toolbar                       ← Search, filter, group, sort, columns, export
              ├── ListViewTable                 ← Virtualized table with resize + sort
              ├── BulkActionBar                 ← Floating bar when rows are selected
              └── Detail drawer                 ← Slide-out panel (page-specific)
```

### ListViewCard props

| Prop | Type | Description |
|------|------|-------------|
| `rows` | `T[]` | Pre-fetched rows (server-paginated) |
| `columnDefs` | `ColumnDef<T>[]` | Column definitions including render fn |
| `views` | `ViewTab[]` | Status tabs with counts (URL-controlled) |
| `activeView` | `string` | Currently active tab ID |
| `buildViewHref` | `(view) => string` | Generates URL for tab switches |
| `filterDefs` | `FilterDef[]` | Filter panel config (`"multi"` or `"daterange"`) |
| `filterRow` | `(row, filterId, vals) => boolean \| null` | Override filter logic per filter ID; `null` falls back to default string-property match |
| `groupOptions` | `GroupOption[]` | Available group-by options |
| `getGroupKey` | `(row, groupBy) => string \| null` | Override group key extraction; `null` falls back to `String(row[groupBy])` |
| `getSortValue` | `(row, colId) => string \| number` | Override sort key extraction per column |
| `defaultSort` | `SortState` | Initial sort (`{ id, dir }`) |
| `rowActions` | `(row, disabled) => ReactNode` | Hover-reveal action buttons per row |
| `renderDrawer` | `(row, onClose) => ReactNode` | Slide-out detail panel |
| `renderBulkActions` | `(rows, onClear) => ReactNode` | Bulk action bar content |
| `page` / `pageSize` / `total` | `number` | Server-side pagination state |
| `buildPageHref` | `(page) => string` | Generates URL for page switches |
| `emptyMessage` | `string` | Empty state copy |

---

## Filter System

### `FilterDef` type

```ts
type FilterDef =
  | { id: string; label: string; type: "multi"; options: FilterOption[] }
  | { id: string; label: string; type: "daterange" }
```

### Multi filter

Renders a list of checkboxes. The default matching logic checks `String(row[id])` against the selected values. Override with `filterRow` for virtual or non-string fields.

### Date range filter

```ts
{ id: "createdAt", label: "Date", type: "daterange" }
```

Renders two date inputs (From / To). Values are stored in `ActiveFilters` as:

```
filters["createdAt"] = ["from:2026-01-01", "to:2026-05-18"]
```

The active-chip bar shows a single formatted chip (`"01 Jan 2026 – 18 May 2026"`). Clicking × clears both bounds.

**Important:** `ListViewCard` does not know how to compare dates — the caller must implement `filterRow` for any `daterange` filter:

```ts
filterRow={(r, filterId, vals) => {
  if (filterId === "createdAt") {
    const from = vals.find(v => v.startsWith("from:"))?.substring(5)
    const to   = vals.find(v => v.startsWith("to:"))?.substring(3)
    const d = new Date(r.createdAt)
    if (from && d < new Date(from + "T00:00:00")) return false
    if (to   && d > new Date(to   + "T23:59:59")) return false
    return true
  }
  return null  // fall back to default for other filters
}}
```

### `filterRow` escape hatch

Called before the default lookup for every active filter. Return `true`/`false` to override, `null` to let `ListViewCard` handle it:

```ts
filterRow={(r, filterId, vals) => {
  if (filterId === "flags") {
    return vals.every(f =>
      (f === "mismatch" && r.mismatch) ||
      (f === "nameDiff" && r.nameDiffers) ||
      (f === "hasNote"  && !!r.transferNote)
    )
  }
  return null
}}
```

---

## Group By System

### Built-in behaviour

`ListViewCard` groups by `String(row[groupBy])`. Works correctly for string fields (`status`, `packageName`, etc.).

### `getGroupKey` escape hatch

Required for Date fields and any non-string value. Return `null` to fall back to the default:

```ts
getGroupKey={(r, grp) => {
  const d = new Date(r.createdAt)
  if (grp === "createdAt:day")   return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  if (grp === "createdAt:month") return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
  if (grp === "createdAt:year")  return String(d.getFullYear())
  return null
}}
```

Use compound IDs (`"createdAt:day"`, `"createdAt:month"`, `"createdAt:year"`) in `groupOptions` to expose multiple granularities for the same field.

---

## Credit Purchase Requests Page

### Files

| File | Role |
|------|------|
| `app/admin/credit/purchase-requests/page.tsx` | Server component — fetches paginated rows + status counts, passes to table |
| `features/points/components/PointPurchaseRequestsTable.tsx` | Client component — column defs, row/bulk actions, detail drawer, dialogs |
| `features/points/db/points.ts` | DB queries and row types |
| `features/points/actions/points.ts` | Server actions |
| `app/admin-list-view.css` | Shared + CPR-specific CSS |

### DB functions

| Function | Description |
|----------|-------------|
| `getPointPurchaseRequestsPaginated(opts)` | Paginated query with optional status filter |
| `getPointPurchaseRequestCounts()` | Single aggregated query returning `{ all, pending, approved, rejected }` |
| `approvePointPurchaseRequest(id, adminId, note?)` | Approve a **pending** request; credits points to user |
| `rejectPointPurchaseRequest(id, adminId, note?)` | Reject a **pending** request |
| `resetPointPurchaseRequestToPending(id)` | Clears status back to `pending`; nulls review fields. Does **not** touch points |
| `overrideApprovePointPurchaseRequest(id, adminId, note?)` | Approves from any status; credits points (guards against double-credit if already approved) |
| `overrideRejectPointPurchaseRequest(id, adminId, note?)` | Rejects from any status; does **not** deduct points |

### Server actions

Each function above has a matching `*Action(formData)` in `features/points/actions/points.ts` with session auth and `canAdminManageUsers` role check.

| Action | FormData keys |
|--------|--------------|
| `approvePointPurchaseRequestAction` | `requestId`, `adminNote?` |
| `rejectPointPurchaseRequestAction` | `requestId`, `adminNote?` |
| `resetPointPurchaseRequestAction` | `requestId` |
| `overrideApprovePointPurchaseRequestAction` | `requestId`, `adminNote?` |
| `overrideRejectPointPurchaseRequestAction` | `requestId`, `adminNote?` |

### Row actions by status

| Status | Row hover buttons | Drawer footer |
|--------|-------------------|---------------|
| `pending` | Approve, Reject | Reject · Approve (credits pts) |
| `approved` | Reject, Revert | Change to Rejected · Revert to Pending |
| `rejected` | Approve, Revert | Revert to Pending · Change to Approved |

> **Note on points:** Approving credits points. Rejecting (including override reject) does **not** deduct points. If an accidentally-approved request is moved to rejected, points remain credited — the admin must handle any manual deduction separately.

### Bulk actions

Shown in the `BulkActionBar` when rows are selected. Only operates on pending rows in the selection:

- **Approve N pending** — loops through pending rows and calls `approvePointPurchaseRequestAction` for each
- **Reject N pending** — opens a dialog for a shared rejection note, then rejects each
- **Clear selection** — always visible

### Column definitions

| Column | Field | Notes |
|--------|-------|-------|
| User | `userName` + `userPhone` | Avatar with initials, phone as sub-line |
| Package | `packageName` | Colored tier swatch |
| Points | `points` | Right-aligned monospace |
| Price | `price` | `MMK XXXXX` |
| Transferred | `transferredAmount` | Amber highlight + diff line when `transferredAmount ≠ price` |
| Transfer Name | `transferredName` | "Differs" badge when name doesn't match `userName` |
| Reference | `transactionReference` | Monospace chip; click copies with 1.5 s "Copied ✓" feedback |
| Note | `transferNote` | Truncated; full text on hover |
| Status | `status` | `StatusPill` — pending (blue), approved (green), rejected (red) |
| Date | `createdAt` | Date + relative time sub-line |

### Filters

| Filter | Type | Logic |
|--------|------|-------|
| Package | `multi` | Matches `packageName` |
| Flags | `multi` | AND logic — every selected flag must match (`mismatch`, `nameDiff`, `hasNote`) |
| Date | `daterange` | Inclusive range on `createdAt` |

### Group By options

| Option ID | Groups by |
|-----------|-----------|
| `package` | `packageName` |
| `status` | `status` |
| `createdAt:day` | `"18 May 2026"` |
| `createdAt:month` | `"May 2026"` |
| `createdAt:year` | `"2026"` |

---

## CSS Extension Points

CPR-specific styles live at the end of `app/admin-list-view.css` under the `/* ── CPR additions ──` comment block. Key classes:

| Class | Purpose |
|-------|---------|
| `.lv-status.approved` | Green pill |
| `.lv-status.rejected` | Red pill |
| `.lv-rowbtn.approve` / `.lv-rowbtn.reject` | Green/red row action buttons |
| `.lv-bulkbtn.approve` / `.lv-bulkbtn.reject` | Bulk bar button variants |
| `.cpr-amount` / `.cpr-amount.mismatch` | Transferred amount cell with amber mismatch state |
| `.cpr-name-warn` | "Differs" badge on transfer name |
| `.cpr-ref` | Monospace reference chip |
| `.cpr-paycard` | Payment summary card in the detail drawer |
| `.cpr-decision` | Approve/Reject button pair in drawer footer |
| `.lv-daterange` | Date range filter inputs |

---

## Adding a New List View Page

1. Create `app/admin/<section>/page.tsx` as a server component following the `lv-pagehead` pattern (breadcrumbs, `lv-h1` with count, `lv-subhead`, `lv-pagehead-actions`).
2. Add a DB function for paginated rows and a counts function (single aggregated SQL query).
3. Create `features/<feature>/components/<Name>Table.tsx` as a client component that wraps `ListViewCard`.
4. Define `columnDefs`, `filterDefs`, `groupOptions` and implement `filterRow` / `getGroupKey` for any non-string fields.
5. Implement `rowActions` and `renderDrawer` for the page's specific actions.
6. Add page-specific CSS at the end of `admin-list-view.css` if needed.
