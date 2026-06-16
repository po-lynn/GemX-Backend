# Premium Dealer Admin Activation — Design Spec

**Date:** 2026-06-16  
**Status:** Approved

---

## Context

GemX has a Premium Dealer (portal) tier that gives shop owners access to the web portal for managing their product listings. The self-service path is fully implemented on mobile: user buys points via KPay/AYA Pay → admin approves purchase request → user activates premium dealer package (spending points).

However, shop owners sometimes contact the admin directly and pay via KPay or online banking without using the mobile app. In this case, the admin must handle the entire workflow on behalf of the user: create the account, record the payment, credit points, and activate the premium dealer subscription.

Currently, the admin can create accounts and credit points directly, but there is no way to:
1. Create a point purchase request for a specific user (only the user can submit from mobile)
2. Activate a premium dealer subscription for a user (only the user can trigger from mobile)

This spec adds these two missing admin capabilities.

---

## User Flows

### Flow 1 — Self-service (already exists, no changes)
1. User signs up on mobile
2. User submits point purchase request (KPay payment proof)
3. Admin approves → points credited
4. User activates premium dealer from mobile → role becomes `portal` → web portal access

### Flow 2 — Admin-initiated (new)
1. Admin creates user account at `/admin/users/new` *(existing)*
2. Admin goes to `/admin/credit/purchase-requests` → clicks **Create Request**
3. Admin selects user, point package, payment method, enters transfer details (reference, amount, name)
4. Purchase request created as "pending"
5. Admin immediately approves it → points credited to user
6. Admin goes to `/admin/credit/premium-dealer-subscriptions` → clicks **Activate Premium Dealer**
7. Admin selects the user and premium dealer package; system shows user's current points balance
8. On confirm: points deducted + subscription record created + user role set to `portal`

---

## Architecture

### What already exists (no changes needed)
- `activatePremiumDealer(userId, pkg, autoRenew)` in `features/points/db/points.ts` — already accepts any userId, not session-bound
- `approvePointPurchaseRequest(requestId, adminId, adminNote?)` — credits points and completes pending transaction
- Admin purchase request approval UI (approve/reject/override row actions)
- Admin user creation at `/admin/users/new`
- Admin direct point credit via `creditUserPoints()` (fallback if admin skips the purchase request step)

### What to build

#### Backend (2 items)

**1. DB function: `adminCreatePointPurchaseRequest`**  
File: `features/points/db/points.ts`

Mirrors the mobile `POST /api/mobile/points/purchase-requests` insert logic, but accepts any `userId` as a parameter instead of reading from session.

Input:
```typescript
{
  userId: string
  packageName: string
  points: number
  price: number
  currency: "mmk" | "usd" | "krw"
  paymentMethod: string
  transferredAmount?: number
  transferredName?: string
  transactionReference?: string
  transferNote?: string
}
```

Behavior:
- Inserts a `pointPurchaseRequest` row with `status: "pending"`
- Inserts a linked `pointTransaction` row with `type: "topup"`, `direction: "credit"`, `status: "pending"`
- Returns `{ id, status, createdAt }`

**2. Server action: `adminActivatePremiumDealerAction`**  
File: `features/points/actions/points.ts`

Input: `{ userId: string, packageName: string, autoRenew: boolean }`

Behavior:
- Guards: `requireFeatureAccess(FEATURE_KEYS.CREDIT_SUBSCRIPTIONS)` (admin or internal with permission)
- Fetches premium dealer packages from settings
- Finds the package by name (returns error if not found/disabled)
- Calls existing `activatePremiumDealer(userId, pkg, autoRenew)`
- Returns `null` (insufficient points) or subscription details
- Revalidates the subscriptions list tag

Also add a thin server action wrapper for the DB function:  
**`adminCreatePointPurchaseRequestAction`** — guards with `FEATURE_KEYS.CREDIT_PURCHASE_REQUESTS`, calls `adminCreatePointPurchaseRequest`, revalidates the purchase-requests list tag.

#### Frontend (4 items)

**3. Component: `AdminCreatePurchaseRequestDialog`**  
File: `features/points/components/AdminCreatePurchaseRequestDialog.tsx`

A dialog/modal triggered from the purchase-requests page. Fields:
- User (searchable combobox — existing user search pattern)
- Point package (dropdown from `getPointPurchasePackages()` settings, shows name + points + price)
- Payment method (dropdown from `getPaymentMethods()` settings)
- Transferred amount (number input)
- Transferred name (text)
- Transaction reference (text)
- Transfer note (optional textarea)

On submit: calls `adminCreatePointPurchaseRequestAction`. On success: closes dialog, the new request appears in the "Pending" tab.

**4. Component: `ActivatePremiumDealerDialog`**  
File: `features/points/components/ActivatePremiumDealerDialog.tsx`

A dialog triggered from the subscriptions page. Fields:
- User (searchable combobox — shows name + current points balance)
- Premium dealer package (dropdown from `getPremiumDealerPackages()` settings, shows name + pointsRequired + durationDays)
- Auto-renew (toggle, default off)

Shows inline: "This package requires X points. User currently has Y points." If Y < X, submit is disabled with explanation.

On submit: calls `adminActivatePremiumDealerAction`. On success: closes dialog, subscription list refreshes.

**5. Update `/app/admin/credit/purchase-requests/page.tsx`**  
Add `<AdminCreatePurchaseRequestDialog />` trigger button in the `lv-pagehead-actions` area alongside the existing Export button.

**6. Update `/app/admin/credit/premium-dealer-subscriptions/page.tsx`**  
Add `<ActivatePremiumDealerDialog />` trigger button in the `lv-pagehead-actions` area alongside the existing Export button.

---

## Data Flow

```
Admin fills Create Request form
  → adminCreatePointPurchaseRequestAction(input)
    → adminCreatePointPurchaseRequest({ userId, ...paymentDetails })
      → INSERT pointPurchaseRequest (status: pending)
      → INSERT pointTransaction (type: topup, status: pending)
  → Request appears in Pending tab

Admin clicks Approve on the new request (existing flow)
  → approvePointPurchaseRequest(requestId, adminId)
    → UPDATE pointPurchaseRequest status → approved
    → creditUserPoints(userId, points)
    → UPDATE pointTransaction status → completed

Admin fills Activate Premium Dealer form
  → adminActivatePremiumDealerAction({ userId, packageName, autoRenew })
    → activatePremiumDealer(userId, pkg, autoRenew)  [existing function]
      → Deduct points from user
      → INSERT premiumDealersPackage (status: active)
      → UPDATE user: role → portal, premiumDealerPackageName, premiumDealerExpiresAt
      → INSERT pointTransaction (type: premium_activation, status: completed)
  → User can now log into web portal
```

---

## Error States

| Scenario | Handling |
|----------|----------|
| User has insufficient points when admin activates | `activatePremiumDealer` returns null; dialog shows error "Insufficient points — approve a purchase request first" |
| Package name not found in settings | Action returns error; dialog shows "Package not found or disabled" |
| User already has an active subscription | Allow re-activation (creates new record, extends subscription) — consistent with existing mobile behavior |
| Network error during dialog submission | Standard form error state; no partial writes (wrapped in DB transaction) |

---

## Permissions

Both new actions use existing RBAC guards:
- `adminCreatePointPurchaseRequestAction` → `FEATURE_KEYS.CREDIT_PURCHASE_REQUESTS`
- `adminActivatePremiumDealerAction` → `FEATURE_KEYS.CREDIT_SUBSCRIPTIONS`

Internal users with the relevant feature permission can perform both actions. Admin users always can.

---

## Testing

**Unit tests** (`tests/unit/admin-premium-dealer-activation.test.ts`):
- `adminCreatePointPurchaseRequest` creates correct pending records
- `adminCreatePointPurchaseRequest` with all optional fields
- `adminActivatePremiumDealerAction` returns error when package not found
- `adminActivatePremiumDealerAction` returns error when insufficient points

**Action tests** (`tests/api/admin-activate-premium-dealer.test.ts`):
- Unauthorized user cannot call `adminActivatePremiumDealerAction`
- Successful activation sets user role to portal and creates subscription record
- Successful purchase request creation appears as pending

**Component tests** (`tests/component/ActivatePremiumDealerDialog.test.tsx`):
- Submit button disabled when user points < package requirement
- Correct points required message shown
- Calls action on submit and closes on success

**End-to-end verification:**
1. Create a test user with 0 points
2. Admin creates a purchase request for that user (250 points)
3. Admin approves it → user now has 250 points
4. Admin activates "Standard Package" for the user
5. Verify: user's role = `portal`, `premiumDealerPackageName` = "Standard Package", subscription record exists with status `active`
6. User logs into web portal — access granted
