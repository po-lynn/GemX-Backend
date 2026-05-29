# Point Transaction History — Technical Notes

## What Changed

Introduced a unified point transaction ledger so every point movement is visible to users via the mobile history API.

### Files touched
- `drizzle/schema/points-schema.ts` — new `pointTransaction` table
- `drizzle/schema/auth-schema.ts` — two new columns on `user`
- `drizzle/migrations/0045_flowery_proteus.sql` — generated migration
- `features/points/db/points.ts` — `logPointTransaction`, `getUserPointBalance`, `getUserPointHistory`; updated `creditUserPoints`, `approvePointPurchaseRequest`, `rejectPointPurchaseRequest`, `activatePremiumDealer`, `processAutoRenewals`, `applyDefaultPointsToNewUser`, `creditDefaultRegistrationPointsToUser`
- `app/api/mobile/points/purchase-requests/route.ts` — logs pending transaction on POST
- `app/api/mobile/products/[id]/feature/route.ts` — logs feature_activation inside transaction
- `app/api/mobile/points/balance/route.ts` — NEW
- `app/api/mobile/points/history/route.ts` — NEW
- `scripts/backfill-point-transactions.ts` — one-time backfill

## Data Flow

```
User action
  │
  ├── Buy points (POST /purchase-requests)
  │     └─ insert point_purchase_request (status=pending)
  │     └─ insert point_transaction (type=topup, status=pending)
  │
  ├── Admin approves (POST /admin/point-purchase-requests/:id/approve)
  │     └─ update point_purchase_request → approved
  │     └─ creditUserPoints → user.points += N, user.pointsLifetime += N
  │     └─ update point_transaction (referenceId=requestId) → completed
  │         (or insert new completed row if request predates ledger)
  │
  ├── Activate premium (POST /mobile/premium-dealers/activate)
  │     └─ db.transaction:
  │           update user.points -= cost
  │           insert premiumDealersPackage (pre-generated UUID)
  │           insert point_transaction (type=premium_activation, debit, completed)
  │
  └── Feature product (POST /mobile/products/:id/feature)
        └─ db.transaction:
              update user.points -= N
              update product (isFeatured=true, featuredExpiresAt)
              logPointTransaction (type=feature_activation, debit, completed)
```

## Schema Impact

### New table: `point_transaction`

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | UUID auto-generated |
| userId | text FK→user | cascade delete |
| type | text | topup / premium_activation / feature_activation / registration_bonus / admin_adjustment |
| direction | text | credit / debit |
| amount | integer | always positive |
| status | text | completed / pending / cancelled / rejected |
| referenceId | text | ID of source row |
| referenceType | text | purchase_request / premium_package / product / registration |
| description | text | human-readable label |
| paymentMethod | text | for topups only |
| createdAt | timestamp | |

Indexes: `(userId)`, `(userId, type)`, `(userId, status)`, `(userId, createdAt)`

### New columns on `user`

| Column | Default | Purpose |
|--------|---------|---------|
| points_lifetime | 0 | Cumulative credits ever received (never decremented) |
| points_reserved | 0 | Reserved points — always 0 until escrow is implemented |

`creditUserPoints()` now increments `pointsLifetime` alongside `points` in a single update.

## Auth & Permissions

- `GET /api/mobile/points/balance` — session auth (any user)
- `GET /api/mobile/points/history` — session auth (any user)
- All write paths remain unchanged (session for mobile, admin session for admin routes)

## Edge Cases

- **Pre-ledger data**: `approvePointPurchaseRequest` tries to update the pending transaction first; if none found (historical request), it inserts a completed row. Run the backfill script once to pre-populate the rest.
- **Reserved points**: Always 0. The column is present for future escrow integration.
- **`setUserPoints` (admin override)**: Does NOT increment `pointsLifetime` — it's a direct set used for corrections. Only `creditUserPoints` increments lifetime.
- **Auto-renewal**: Each renewal in `processAutoRenewals` inserts a `point_transaction` with a pre-generated UUID to avoid needing `.returning()` inside the transaction.
