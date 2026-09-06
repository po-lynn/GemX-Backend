# Fix stuck All Users Top-up on Vercel

## What you saw

Drawer: **Status processing**, **Processed 0 / N** — campaign queued, no credits.

## Fix (deployed in app)

Top-up now **credits users in the same request** by default on Vercel. After deploy, a new All Users Top-up should finish as **completed** within seconds (for ~40 users).

## After deploy

1. Ensure Vercel does **not** set `SURPRISE_BONUS_SYNC_PROCESS=false` (unless cron is proven working).
2. Redeploy.
3. Clear the stuck campaign:

```bash
curl -X POST "https://YOUR_VERCEL_HOST/api/cron/process-surprise-bonus" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Or submit a small new Top-up — inline drain also processes older pending `background_jobs`.

4. Confirm in SQL:

```sql
SELECT status, processed_users, success_count FROM surprise_bonus_campaign ORDER BY created_at DESC LIMIT 5;
SELECT status, last_error FROM background_jobs WHERE type = 'surprise_bonus_batch' ORDER BY created_at DESC LIMIT 10;
```

## If it still fails

- API error mentioning `claim_background_job` / `grant_surprise_bonus_user` → run migration `0081_surprise_bonus_queue.sql` on Supabase.
- Check Vercel function logs for `[surprise-bonus] inline drain failed`.
