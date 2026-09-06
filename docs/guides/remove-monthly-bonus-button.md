# Point Transactions header actions (no Monthly Bonus button)

## Prerequisites

Admin access with `CREDIT_TRANSACTIONS` permission.

## How to use

1. Open **Admin → Points & Credits → All Transactions** (`/admin/credit/transactions`).
2. Header actions are **Top-up** and **Deduct** only.
3. Top-up → **All Users** still uses the eligible active-user count from `countEligibleMonthlyBonusUsers()`.

## How to extend

To restore Monthly Bonus settings UI, re-import `MonthlyBonusSettingsDialog` in `PointActionButtons.tsx`, fetch `getMonthlyBonusSettings()` on the page, and add the header button again. See `docs/technical/monthly-bonus-points.md`.

## Common errors

None specific — if Top-up All Users shows `0 users`, the eligible-count query returned empty (banned/archived filters).
