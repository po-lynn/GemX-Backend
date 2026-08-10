# Cron: Monthly bonus points

**Endpoint:** `POST /api/cron/monthly-bonus-points`  
**Auth:** `Authorization: Bearer $CRON_SECRET`  
**Mobile flag:** no (internal cron)

## Behavior

Grants all **due** monthly-bonus cycles for the configured program (every 30 days from distribution start date, up to 1/3/6/12 cycles). Credits every non-banned, non-archived user once per cycle and inserts `point_transaction` rows (`type: monthly_bonus`).

Scheduled in `vercel.json` daily (`0 1 * * *`) so 30-day boundaries are not missed.

## Response 200 (example)

```json
{
  "skipped": false,
  "enabled": true,
  "amount": 100,
  "cycles": 6,
  "startDate": "2023-10-01",
  "today": "2023-10-01",
  "cyclesProcessed": [1],
  "usersCredited": 1500,
  "alreadyHadGrant": 0,
  "errors": 0
}
```

When skipped: `{ "skipped": true, "reason": "disabled" | "amount_zero" | "missing_start_date" | "no_cycle_due_yet", … }`.

## Errors

- `401 Unauthorized` — bad/missing bearer
- `500 Cron not configured` — missing `CRON_SECRET`
- `500 Internal server error` — unexpected failure

## Example

```bash
curl -X POST "https://your-host/api/cron/monthly-bonus-points" \
  -H "Authorization: Bearer $CRON_SECRET"
```
