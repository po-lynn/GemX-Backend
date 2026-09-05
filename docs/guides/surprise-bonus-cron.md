# Surprise Bonus cron + Edge Function

> **Preferred on Vercel:** use the Next.js cron  
> [`/api/cron/process-surprise-bonus`](../api/cron-process-surprise-bonus.md)  
> (wired in `vercel.json`) plus `after()` drain — see [surprise-bonus-vercel.md](./surprise-bonus-vercel.md).  
> The Supabase Edge Function below is **optional** extra capacity.

## Prerequisites

1. Apply migration: `npm run db:migrate` (includes `0081_surprise_bonus_queue.sql`).
2. Deploy Edge Function:
   ```bash
   supabase functions deploy process-background-jobs
   ```
3. Set function secrets:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET` (recommended; required for FCM proxy)
   - `APP_URL` — your Next.js origin (e.g. `https://your-app.vercel.app`) so the Edge Function can call `/api/cron/surprise-bonus-push`
4. App env: `CRON_SECRET` (same value), `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.

## Schedule (every 1 minute)

### Option A — Supabase Dashboard

**Edge Functions → process-background-jobs → Schedules** → cron `* * * * *`.

If `CRON_SECRET` is set, configure the Authorization header:
`Bearer <CRON_SECRET>`.

### Option B — pg_cron + pg_net

```sql
select cron.schedule(
  'process-surprise-bonus-jobs',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/process-background-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || '<CRON_SECRET_OR_ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## Behaviour

- One invocation claims **one** pending `surprise_bonus_batch` job.
- Processes up to **100** users (keyset pagination).
- Enqueues the next job if more users remain; otherwise marks the campaign `completed`.
- For newly granted users (`granted: true`), POSTs to `{APP_URL}/api/cron/surprise-bonus-push` to send FCM (same title/body as `app_notification`).
- Retries failed jobs with delayed `available_at` up to `max_attempts`.
- Push failures do **not** roll back points or `app_notification` rows.

## Local admin flow

1. `npm run db:migrate`
2. **Local/dev default:** just run `npm run dev` and submit All Users Top-up — the API drains jobs inline (`SURPRISE_BONUS_SYNC_PROCESS` unset + non-production).
3. **Or** force Cron-only locally with `SURPRISE_BONUS_SYNC_PROCESS=false`, then deploy/schedule the Edge Function (or invoke manually):
   ```bash
   curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/process-background-jobs" \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
4. Admin → Point Transactions → Top-up → All Users → campaign name + points → submit.
5. Drawer shows progress via `GET /api/admin/points/surprise-bonus/[id]` (local sync usually already `completed`).
