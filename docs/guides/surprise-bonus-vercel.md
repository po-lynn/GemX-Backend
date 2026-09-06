# Guide: Surprise Bonus on Vercel (no Edge Function required)

## Prerequisites

1. Migration applied (`0081` / `0082` surprise bonus tables + RPCs).
2. Vercel env: `CRON_SECRET`, `DATABASE_URL`, optional `FIREBASE_*` for push.
3. Deploy includes `vercel.json` cron for `/api/cron/process-surprise-bonus`.

## How it works

1. Admin Top-up → All Users creates campaign + job (`status: processing`).
2. Response returns immediately; Next.js **`after()`** starts draining the queue.
3. Vercel Cron hits **`/api/cron/process-surprise-bonus`** every minute to finish large runs.
4. Admin drawer polls `GET /api/admin/points/surprise-bonus/[id]` until `completed`.

## Manual kick (stuck campaign)

```bash
curl -X POST "https://YOUR_VERCEL_HOST/api/cron/process-surprise-bonus" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Inspect queue in Supabase SQL — see [surprise-bonus-queue.md](../technical/surprise-bonus-queue.md).

## Common errors

| Symptom | Fix |
|---------|-----|
| Stays `processing` forever | Confirm cron exists in Vercel project → Cron Jobs; `CRON_SECRET` set |
| Cron 401 | Bearer must match Vercel `CRON_SECRET` |
| Cron 500 Cron not configured | Add `CRON_SECRET` and redeploy |
| Jobs `failed` | Read `background_jobs.last_error`; ensure RPCs exist |
