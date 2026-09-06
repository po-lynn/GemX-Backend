# Remove Monthly Bonus Points button from Point Transactions

## What changed and why

Removed the **Monthly Bonus Points** header button (and its settings drawer) from Admin → Point Transactions. Top-up / Deduct remain. Cron + DB settings for monthly bonus are unchanged — only the admin UI entry point on this page was removed.

### Files touched

| Path | Change |
|------|--------|
| `features/points/components/PointActionButtons.tsx` | Dropped button, `MonthlyBonusSettingsDialog`, and `monthlyBonus` prop; prop renamed to `activeUserCount` |
| `app/admin/credit/transactions/page.tsx` | Stopped loading `getMonthlyBonusSettings()`; still loads eligible-user count for Top-up → All Users |
| `tests/unit/admin-transactions-page-query-timing.test.ts` | Dropped `getMonthlyBonusSettings` mock |
| `docs/technical/monthly-bonus-points.md` / `docs/guides/monthly-bonus-points.md` | Note UI entry removed |

`MonthlyBonusSettingsDialog.tsx` and `saveMonthlyBonusSettingsAction` remain in the codebase (unused from this page) so cron/settings can be re-wired later if needed.

## Data flow

```
/admin/credit/transactions
  → countEligibleMonthlyBonusUsers()  // still used as Top-up “All Users” count
  → PointActionButtons({ activeUserCount })
       → Top-up / Deduct drawers only
```

## Schema impact

None.

## Auth & permissions

Unchanged — still `FEATURE_KEYS.CREDIT_TRANSACTIONS` via `requireFeatureAccess`.

## Edge cases & known limitations

- Monthly bonus **cron** (`POST /api/cron/monthly-bonus-points`) still runs if settings were previously saved in `point_setting`.
- There is no remaining admin UI on this page to enable/edit the program; change settings via DB/`point_setting` or restore the dialog later.
