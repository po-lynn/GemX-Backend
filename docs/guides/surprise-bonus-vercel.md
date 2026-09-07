# Guide: Surprise Bonus on Vercel

Surprise Bonus is **admin-triggered only** — there is no schedule, no cron, and no async mode. An admin clicks **Top-up → All Users** whenever they want to run a campaign, and that single request credits every active user before it responds. For ~40 users this finishes in seconds; the drawer shows **completed**, not stuck **processing**.

## Prerequisites

1. Migration applied (`0081` surprise bonus tables + RPCs, `0087` stale-processing-job reclaim).
2. Vercel env: `DATABASE_URL`, optional `FIREBASE_*` for push. `CRON_SECRET` is not needed for this feature (it's still used by the unrelated `monthly-bonus-points` and `surprise-bonus-push` crons).

## Unstick a campaign already at processing 0/N

There's no separate recovery cron to call — just submit **any** Top-up again (even a small one, or the same campaign amount). Its inline drain claims the queue in `available_at`/`created_at` order, so it reclaims the stranded job (once its lock is >3 min old, migration `0087`) before starting the new one. See [fix-stuck-surprise-bonus.md](./fix-stuck-surprise-bonus.md).

## Very large campaigns (thousands of users)

The request has a 60s budget (`maxDuration` on `/api/admin/points/surprise-bonus`). If a campaign is large enough to exceed it, the batch in flight gets cut off mid-run and stays `processing` until the next Top-up submission reclaims it (see above) — there's no automatic background continuation. For a user base that size, expect to submit the Top-up more than once, a few minutes apart, until the drawer shows `completed`.

## Common errors

| Symptom | Fix |
|---------|-----|
| Stays `processing`, 0 processed | Submit the Top-up again — its inline drain reclaims the stranded job (see above) |
| Error `crediting failed` / missing function | Apply `0081_surprise_bonus_queue.sql` (and `0087_reclaim_stale_surprise_bonus_jobs.sql`) |
