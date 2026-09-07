# Fix stuck All Users Top-up on Vercel

## What you saw

Drawer: **Status processing**, **Processed 0 / N** — campaign queued, no credits.

## Fix (deployed in app)

Top-up now **credits users in the same request** by default on Vercel. After deploy, a new All Users Top-up should finish as **completed** within seconds (for ~40 users).

## After deploy

**Update (later fix):** the async opt-out (`SURPRISE_BONUS_SYNC_PROCESS`), the `after()` drain, and `/api/cron/process-surprise-bonus` have since been removed entirely — Surprise Bonus is inline-only now, admin-triggered, no cron. See [surprise-bonus-vercel.md](./surprise-bonus-vercel.md).

1. Redeploy.
2. Clear a stuck campaign by submitting any Top-up (even a small one) — its inline drain reclaims older stranded `background_jobs` rows (>3 min stale, migration `0087`) before starting the new one.
3. Confirm in SQL:

```sql
SELECT status, processed_users, success_count FROM surprise_bonus_campaign ORDER BY created_at DESC LIMIT 5;
SELECT status, last_error FROM background_jobs WHERE type = 'surprise_bonus_batch' ORDER BY created_at DESC LIMIT 10;
```

## If it still fails

- API error mentioning `claim_background_job` / `grant_surprise_bonus_user` → run migration `0081_surprise_bonus_queue.sql` on Supabase.
- Check Vercel function logs for `[surprise-bonus] inline drain failed`.
