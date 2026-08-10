# Guide: Monthly bonus points

## Prerequisites

```bash
# .env.local
CRON_SECRET=your-cron-secret
```

No DB migration required (uses `point_setting` keys).

## Configure (admin)

1. Open **Admin → Point Packages** (`/admin/credit`).
2. Click **Monthly Bonus** (header) or **Configure** on the Defaults tab card.
3. Set:
   - Enable program
   - Points per month
   - Duration: 1 / 3 / 6 / 12 months
   - Distribution start date
4. Preview the schedule, then **Save Changes**.

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

## Common errors

| Symptom | Fix |
|---------|-----|
| Cron 500 Cron not configured | Set `CRON_SECRET` |
| Cron 401 | Wrong bearer token |
| Cron `skipped: missing_start_date` | Set start date in admin UI |
| Users not credited | Confirm program enabled; check they are not banned/archived |
