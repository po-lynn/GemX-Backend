# Surprise Bonus cron + Edge Function

> Surprise Bonus is normally **inline-only, admin-triggered** — see
> [surprise-bonus-vercel.md](./surprise-bonus-vercel.md). There is no Vercel
> cron for this feature. The Supabase Edge Function below is a separate,
> fully **optional** extra worker for anyone who wants a standing drain
> outside the app's own request/response cycle; most deployments don't need it.

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
2. Run `npm run dev`, then Admin → Point Transactions → Top-up → All Users → campaign name + points → submit. The API always drains jobs inline — no cron/Edge Function needed.
3. The drawer shows `completed` immediately from the POST response.

If you deploy this Edge Function anyway (e.g. as a standing safety net you want independent of the app), it can still claim and drain any job it finds — it talks to the same `background_jobs` queue directly. In practice a job is rarely still `pending`/stale by the time this runs, since the admin's own request already drained it inline.
