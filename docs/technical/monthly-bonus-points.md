# Monthly bonus points program

## What changed

Admin can configure a **Monthly Bonus Points** program (enable, amount, duration 1/3/6/12 months, distribution start date). A **daily cron** grants points to all non-banned, non-archived users every **30 days** from the start date, for up to N cycles. Each grant writes a `point_transaction` row (`type: monthly_bonus`).

### Files

| Path | Role |
|------|------|
| `features/points/db/monthly-bonus.ts` | Settings + schedule + grant logic |
| `features/points/actions/points.ts` | `saveMonthlyBonusSettingsAction` |
| `features/points/components/MonthlyBonusSettingsDialog.tsx` | Admin modal UI |
| `features/points/components/CreditSettingsForm.tsx` | Entry points on Point Packages page |
| `app/admin/credit/page.tsx` | Loads settings + eligible user count |
| `app/api/cron/monthly-bonus-points/route.ts` | Cron endpoint |
| `vercel.json` | Daily schedule `0 1 * * *` |

## Data flow

```
Admin saves settings → point_setting keys
  monthly_bonus_enabled / amount / cycles / start_date

Daily cron POST /api/cron/monthly-bonus-points (Bearer CRON_SECRET)
  → grantDueMonthlyBonusPoints()
      for each due cycle (start + (n-1)*30 days ≤ today):
        skip users already having referenceId mb:{start}:c{n}
        creditUserPoints + logPointTransaction(type=monthly_bonus)
```

## Settings (no new table)

Stored in existing `point_setting` KV:

| Key | Storage |
|-----|---------|
| `monthly_bonus_enabled` | value 0/1 |
| `monthly_bonus_amount` | value int |
| `monthly_bonus_cycles` | value 1\|3\|6\|12 |
| `monthly_bonus_start_date` | value_text `YYYY-MM-DD` |

## Auth

- Admin UI / save action: `canAdminManageUsers`
- Cron: `Authorization: Bearer $CRON_SECRET`

## Edge cases

- Idempotent per user+cycle via `referenceId`
- Catch-up: if cron was down, all past-due unpaid cycles grant on next run
- Banned / archived users excluded
- Disabled / zero amount / missing start date → cron skips
- Cron is **daily** (not monthly) so exact +30-day due dates are not missed
