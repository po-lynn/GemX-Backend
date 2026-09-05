# Guide: Monthly bonus points

## Prerequisites

```bash
# .env.local
CRON_SECRET=your-cron-secret
```

No DB migration required for settings (uses `point_setting` keys).

**One-time:** seed the GemX notifications system user (chat sender):

```bash
psql "$DATABASE_URL" -f scripts/create-gemx-notifications-system-user.sql
```

## Configure (admin)

> **UI note:** The **Monthly Bonus Points** button was removed from Point Transactions. Settings are no longer editable from that page header. Existing `point_setting` values still drive the cron; change them in the DB or restore `MonthlyBonusSettingsDialog` if needed.

Previously:

1. Open **Admin → Point Transactions** (`/admin/credit/transactions`).
2. Click **Monthly Bonus Points** (header, left of **Top-up**).
3. Set enable / amount / duration / start date, then **Save Changes**.

## Cron

Vercel Cron hits daily at 01:00 UTC:

```
POST /api/cron/monthly-bonus-points
Authorization: Bearer $CRON_SECRET
```

Local smoke test:

```bash
curl -X POST "http://localhost:3000/api/cron/monthly-bonus-points" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## How grants work

- Cycle 1 on start date; cycle 2 at start+30 days; … up to N cycles.
- Every non-banned, non-archived user receives the amount once per cycle.
- Ledger: `point_transaction.type = monthly_bonus`, `referenceId = mb:{YYYY-MM-DD}:c{n}`.
- After each successful credit, a chat message is sent from **GemX** (`sys-gemx-notifications`) with English title/body, plus the normal chat FCM push and realtime broadcast.

## Extending locale

Copy lives in `features/points/constants/monthly-bonus-notify.ts` (`en` / `my` / `th` / `ko`). Runtime currently always passes `"en"`. When users have a language preference, pass that locale into `getMonthlyBonusNotifyCopy`.

## Common errors

| Symptom | Fix |
|---------|-----|
| Cron 500 Cron not configured | Set `CRON_SECRET` |
| Cron 401 | Wrong bearer token |
| Cron `skipped: missing_start_date` | Set start date in admin UI |
| Users not credited | Confirm program enabled; check they are not banned/archived |
| Points granted but no chat | Run `scripts/create-gemx-notifications-system-user.sql`; check server logs for `[monthly-bonus]` |
