# Guide: Surprise Bonus on Vercel

## Default (recommended)

Leave `SURPRISE_BONUS_SYNC_PROCESS` **unset**. All Users Top-up credits users **in the same request**. For ~40 users this finishes in seconds; the drawer shows **completed**, not stuck **processing**.

## Prerequisites

1. Migration applied (`0081` surprise bonus tables + RPCs).
2. Vercel env: `DATABASE_URL`, optional `FIREBASE_*`, `CRON_SECRET` (for stuck-job recovery cron).

## Unstick a campaign already at processing 0/N

```bash
curl -X POST "https://YOUR_VERCEL_HOST/api/cron/process-surprise-bonus" \
  -H "Authorization: Bearer $CRON_SECRET"
```

See [fix-stuck-surprise-bonus.md](./fix-stuck-surprise-bonus.md).

## Async mode (optional)

Only if you need huge campaigns outside the 60s function limit:

```env
SURPRISE_BONUS_SYNC_PROCESS=false
```

Requires working minutely cron `/api/cron/process-surprise-bonus` (Pro plan for `* * * * *`).

## Common errors

| Symptom | Fix |
|---------|-----|
| Stays `processing`, 0 processed | Redeploy with inline default; do not set `SURPRISE_BONUS_SYNC_PROCESS=false` |
| Error `crediting failed` / missing function | Apply `0081_surprise_bonus_queue.sql` |
| Cron 401 | Match `CRON_SECRET` |
