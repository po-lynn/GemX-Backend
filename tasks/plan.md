# Implementation Plan: Admin Premium Dealer Subscription Management

## Overview

Build an admin UI page at `/admin/credit/premium-dealer-subscriptions` where admins can view all premium dealer subscription history (all statuses), filter by status, manually deactivate an active subscription, and manually set or update a subscription's expiry date. Follows the existing `PointPurchaseRequestsTable` + server-action pattern exactly.

## Architecture Decisions

- **No DB migration required.** All data lives in the existing `premium_dealers_packages` table (id, userId, packageName, startDate, endDate, autoRenew, status, createdAt) joined to `user` for name/email.
- **User fields are a cache.** `user.premiumDealerPackageName` and `user.premiumDealerExpiresAt` are denormalized fields that must be kept in sync when an admin mutates the active subscription row.
- **Deactivation** = set `status = 'cancelled'` on the subscription row + atomically clear `user.premiumDealerPackageName` / `user.premiumDealerExpiresAt` only when this row's `userId` still has the same `packageName` and `endDate` (to avoid clearing a newer active subscription).
- **Update expiry** = update `endDate` on the subscription row + sync `user.premiumDealerExpiresAt` if the row `status = 'active'`.
- **Server actions** (not a new API route) — all mutations go through `features/points/actions/points.ts`, same as purchase-request approval.
- **Sidebar**: new nav item under the Settings group, between "Purchase Requests" and "Feature Settings".

## Dependency Graph

```
premium_dealers_packages table (exists)
user table (exists)
    │
    ├── DB query: getPremiumDealerSubscriptionsPaginated()   [Task 1]
    ├── DB mutations: deactivate + updateExpiry              [Task 2]
    │       │
    │       └── Server actions (points.ts)                  [Task 3]
    │               │
    │               └── PremiumDealerSubscriptionsTable.tsx [Task 4]
    │                       │
    │                       └── Admin page + sidebar link   [Task 5]
```

---

## Phase 1: Data Layer

### Task 1: DB query — paginated subscriptions list

**Description:** Add `getPremiumDealerSubscriptionsPaginated()` to `features/points/db/points.ts`. Returns all subscriptions across all statuses (active, expired, cancelled) with user name and email, ordered by `createdAt DESC`, with optional status filter and total count for pagination.

**Acceptance criteria:**
- [ ] Returns `{ subscriptions: PremiumDealerSubscriptionRow[], total: number }`
- [ ] Accepts `{ page, limit, status?: 'active' | 'expired' | 'cancelled' }` — omit status means all
- [ ] Each row includes: `id, userId, userName, userEmail, packageName, startDate, endDate, autoRenew, status, createdAt`
- [ ] Export `PremiumDealerSubscriptionRow` type from `points.ts`

**Verification:**
- [ ] TypeScript compiles: `npm run build` (or `tsc --noEmit`)
- [ ] No existing tests broken: `npm run test:unit`

**Dependencies:** None

**Files touched:**
- `features/points/db/points.ts`

**Estimated scope:** S

---

### Task 2: DB mutations — deactivate + update expiry

**Description:** Add two mutation functions to `features/points/db/points.ts`:
1. `deactivatePremiumDealerSubscription(subscriptionId)` — sets `status = 'cancelled'` on the row; in the same transaction, if `user.premiumDealerExpiresAt` matches the row's `endDate` for that userId, clears both user cache fields to null.
2. `updatePremiumDealerSubscriptionExpiry(subscriptionId, newEndDate)` — updates `endDate` on the row; if `status = 'active'`, also updates `user.premiumDealerExpiresAt`.

**Acceptance criteria:**
- [ ] `deactivatePremiumDealerSubscription` returns `{ success: false, reason: 'not_found' | 'not_active' } | { success: true }`
- [ ] `updatePremiumDealerSubscriptionExpiry` returns `{ success: false, reason: 'not_found' } | { success: true }`
- [ ] Both run inside `db.transaction()` for atomicity
- [ ] User cache fields are synced correctly (see architecture decisions)

**Verification:**
- [ ] TypeScript compiles
- [ ] Unit tests for both functions: `npm run test:unit`

**Dependencies:** Task 1 (types already in file)

**Files touched:**
- `features/points/db/points.ts`
- `tests/unit/premium-dealer-activation.test.ts` (add deactivate + updateExpiry cases)

**Estimated scope:** M

---

### Checkpoint: Phase 1

- [ ] `npm run test:unit` — all unit tests pass
- [ ] `npm run build` — compiles without errors
- [ ] Review mutation logic with human before proceeding

---

## Phase 2: Server Actions + Table Component

### Task 3: Server actions for deactivate + update expiry

**Description:** Add two server actions to `features/points/actions/points.ts`:
1. `deactivatePremiumDealerAction(formData)` — reads `subscriptionId`, checks admin session via `canAdminManageUsers`, calls `deactivatePremiumDealerSubscription`.
2. `updateSubscriptionExpiryAction(formData)` — reads `subscriptionId` + `newEndDate` (ISO string), validates the date is in the future, calls `updatePremiumDealerSubscriptionExpiry`.

**Acceptance criteria:**
- [ ] Both return `{ error: string }` on auth failure or invalid input
- [ ] Both return `{ success: true }` on success
- [ ] `newEndDate` validated: must be a valid date, must be after `now()`
- [ ] Auth guard: `canAdminManageUsers(session.user.role)` same as other actions in this file

**Verification:**
- [ ] TypeScript compiles
- [ ] API tests for the actions: `npm run test:api`

**Dependencies:** Task 2

**Files touched:**
- `features/points/actions/points.ts`

**Estimated scope:** S

---

### Task 4: `PremiumDealerSubscriptionsTable` client component

**Description:** Create `features/points/components/PremiumDealerSubscriptionsTable.tsx`. A `"use client"` component mirroring `PointPurchaseRequestsTable` structure. Columns: User (name + email), Package, Start Date, Expiry Date, Days Remaining (computed), Auto-Renew, Status badge, Actions.

Actions column:
- If `status === 'active'`: show **Deactivate** button (opens confirmation dialog) + **Set Expiry** button (opens date-picker dialog with a `<input type="date">`)
- Otherwise: `—`

Both actions call their respective server actions, then `router.refresh()`.

**Acceptance criteria:**
- [ ] Renders table via `AdminTableShell`, `AdminStatusBadge`, `adminTH/adminTD` helpers (same as `PointPurchaseRequestsTable`)
- [ ] Deactivate dialog: confirm prompt, loading state, error display
- [ ] Set Expiry dialog: date input defaulting to current expiry, submit disabled if date is today or past
- [ ] Empty state row when `subscriptions.length === 0`
- [ ] Status badge maps: `active` → green, `expired` → slate, `cancelled` → red

**Verification:**
- [ ] TypeScript compiles
- [ ] Visual: renders without console errors in browser

**Dependencies:** Task 3

**Files touched:**
- `features/points/components/PremiumDealerSubscriptionsTable.tsx`

**Estimated scope:** M

---

### Checkpoint: Phase 2

- [ ] `npm run test` — all tests pass
- [ ] `npm run build` — clean

---

## Phase 3: Admin Page + Navigation

### Task 5: Admin page + sidebar nav link

**Description:** Create the admin page and wire up navigation.

**Page** at `app/admin/credit/premium-dealer-subscriptions/page.tsx`:
- Server component, `await connection()`
- Reads `page`, `status` from `searchParams`
- Calls `getPremiumDealerSubscriptionsPaginated()`
- Renders: page header ("Premium Dealer Subscriptions"), total count, status filter tabs (all / active / expired / cancelled), `<PremiumDealerSubscriptionsTable>`, pagination buttons — same structure as `app/admin/credit/purchase-requests/page.tsx`
- Default status filter: `all` (unlike purchase-requests which defaults to `pending`)

**Sidebar**: add nav item in `components/admin/AdminSidebar.tsx` under Settings group, between "Purchase Requests" and "Feature Settings":
```
{ href: "/admin/credit/premium-dealer-subscriptions", label: "Dealer Subscriptions", icon: Crown, color: "#f59e0b" }
```

**Acceptance criteria:**
- [ ] Page loads at `/admin/credit/premium-dealer-subscriptions`
- [ ] Status filter tabs update the URL and filter the list correctly
- [ ] Pagination works (prev/next buttons)
- [ ] Sidebar link is active-highlighted when on this route
- [ ] Page shows correct total count in header

**Verification:**
- [ ] `npm run build` — no build errors
- [ ] Manual: visit page in browser, confirm all tabs and pagination work
- [ ] Manual: deactivate an active subscription — row status changes to `cancelled`
- [ ] Manual: set expiry on an active subscription — expiry date updates

**Dependencies:** Task 4

**Files touched:**
- `app/admin/credit/premium-dealer-subscriptions/page.tsx`
- `components/admin/AdminSidebar.tsx`

**Estimated scope:** M

---

### Checkpoint: Complete

- [ ] `npm run test` — all tests pass
- [ ] `npm run build` — clean, no TypeScript errors
- [ ] Manual walkthrough: list, filter, deactivate, set expiry all work end-to-end
- [ ] Ready for review

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| User cache fields (`premiumDealerPackageName`, `premiumDealerExpiresAt`) get out of sync | Medium | Run sync in same transaction; match on `endDate` to avoid clearing a newer row |
| Admin deactivates a row that already expired | Low | Guard: return `not_active` if `status !== 'active'` |
| Date input timezone mismatch (browser local vs UTC) | Low | Store as UTC; display in `toLocaleDateString()` on client |

## Open Questions

- None — requirements are fully specified.
