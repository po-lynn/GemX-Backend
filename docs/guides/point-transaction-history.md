# Guide: Point Transaction History

## Overview

The point history feature gives users a full ledger of every point movement — top-ups, premium activations, product featuring, and registration bonuses — accessible via two mobile API endpoints.

## Prerequisites

- `DATABASE_URL` configured and migration `0045_flowery_proteus.sql` applied (`npm run db:migrate`)
- For historical data: run the backfill script once (see below)

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/mobile/points/balance` | Available / reserved / lifetime totals |
| `GET /api/mobile/points/history` | Paginated transaction list with filter |

See `docs/api/mobile-points-balance.md` and `docs/api/mobile-points-history.md` for full specs.

## Backfilling Historical Data

After deploying migration 0045 to production, run the one-time backfill:

```bash
npx tsx scripts/backfill-point-transactions.ts
```

This will:
1. Insert a `point_transaction` row for every existing `point_purchase_request` (approved → completed, rejected → rejected, pending → pending)
2. Insert a `point_transaction` row for every `premium_dealers_packages` activation (with `amount=0` as a placeholder — the exact points cost wasn't stored on the subscription row)
3. Set `user.pointsLifetime` to the sum of all completed credit transactions per user

## How New Transactions Are Logged

Every point movement now writes to `point_transaction` automatically:

| Action | Where logged |
|--------|-------------|
| Submit purchase request | `POST /api/mobile/points/purchase-requests` → status=pending |
| Admin approves request | `approvePointPurchaseRequest()` → status=completed |
| Admin rejects request | `rejectPointPurchaseRequest()` → status=rejected |
| Activate premium dealer | `activatePremiumDealer()` inside db.transaction |
| Feature a product | `POST /api/mobile/products/:id/feature` inside db.transaction |
| Registration bonus | `applyDefaultPointsToNewUser()` / `creditDefaultRegistrationPointsToUser()` |

## Adding a New Transaction Type

1. Pick a `type` string (e.g. `"escrow_hold"`) and a `referenceType` (e.g. `"escrow"`)
2. Call `logPointTransaction({ userId, type, direction, amount, status, referenceId, referenceType, description })` after the point operation succeeds
3. For debit operations inside a `db.transaction`, pass the `tx` client — OR pre-generate the reference ID so you can log after the transaction commits
4. Update the filter logic in `getUserPointHistory` if the new type needs its own filter tab

## Extending the Balance

To add a `pointsReserved` value (e.g. for escrow holds):
1. Increment `user.pointsReserved` when placing a hold
2. Decrement it when the hold is released or forfeited
3. `getUserPointBalance` already returns `reserved` from the `user.pointsReserved` column

## Common Errors

**`"Failed to load balance"` (500)** — Check `DATABASE_URL` and that migration 0045 was applied.

**`"Failed to load point history"` (500)** — Same as above. Also ensure `point_transaction` table exists.

**`"Invalid query params"` (400)** — `filter` must be one of `all`, `topups`, `spent`, `pending`. `page` and `limit` must be positive integers.
