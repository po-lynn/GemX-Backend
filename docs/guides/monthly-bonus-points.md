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

## Configure

There is **no admin UI** on Point Transactions for this program anymore. Settings live in `point_setting`:

| Key | Storage |
|-----|---------|
| `monthly_bonus_enabled` | value `0` / `1` |
| `monthly_bonus_amount` | value int |
| `monthly_bonus_cycles` | value `1` \| `3` \| `6` \| `12` |
| `monthly_bonus_start_date` | value_text `YYYY-MM-DD` |

Example (SQL):

```sql
INSERT INTO point_setting (key, value, value_text) VALUES
  ('monthly_bonus_enabled', 1, NULL),
  ('monthly_bonus_amount', 100, NULL),
  ('monthly_bonus_cycles', 6, NULL),
  ('monthly_bonus_start_date', 0, '2026-01-01')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, value_text = EXCLUDED.value_text;
```

(Or update existing rows via Drizzle Studio / SQL editor.)

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
| Cron `skipped: missing_start_date` | Set `monthly_bonus_start_date` in `point_setting` |
| Users not credited | Confirm `monthly_bonus_enabled=1`; check they are not banned/archived |
| Points granted but no chat | Run `scripts/create-gemx-notifications-system-user.sql`; check server logs for `[monthly-bonus]` |
