# Monthly bonus points program

## What changed

Admin can configure a **Monthly Bonus Points** program (enable, amount, duration 1/3/6/12 months, distribution start date). A **daily cron** grants points to all non-banned, non-archived users every **30 days** from the start date, for up to N cycles. Each grant writes a `point_transaction` row (`type: monthly_bonus`).

After each successful credit, the cron also sends a **GemX system chat message** (+ chat push / realtime broadcast) so the user is notified in-app.

### Files

| Path | Role |
|------|------|
| `features/points/db/monthly-bonus.ts` | Settings + schedule + grant logic |
| `features/points/services/notify-monthly-bonus.ts` | Chat + push notify after grant |
| `features/points/constants/monthly-bonus-notify.ts` | System sender id + EN/MY/TH/KO copy |
| `scripts/create-gemx-notifications-system-user.sql` | Seed `sys-gemx-notifications` user |
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
        notifyMonthlyBonusGranted()  // best-effort chat + push
          → messages insert (sender=sys-gemx-notifications)
          → sendChatMessageNotification (title/body EN)
          → broadcastChatEvents
```

## Notification copy (English at runtime)

- **Title:** Your monthly bonus points have arrived! 🗓️
- **Body:** Your monthly drop of {amount} points is ready. Check your updated points balance now.
- Chat `content` = title + blank line + body
- MY/TH/KO strings live in `MONTHLY_BONUS_NOTIFY_COPY` for later locale preference

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
- Chat sender: system user `sys-gemx-notifications` (banned+archived; no credentials)

## Edge cases

- Idempotent per user+cycle via `referenceId`
- Catch-up: if cron was down, all past-due unpaid cycles grant on next run
- Banned / archived users excluded
- Disabled / zero amount / missing start date → cron skips
- Cron is **daily** (not monthly) so exact +30-day due dates are not missed
- Notify failures are logged and **do not** fail the points grant
- If the system user row is missing, message insert fails silently (run the SQL seed script)
