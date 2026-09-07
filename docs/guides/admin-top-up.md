# Admin Top-up Points & Surprise Bonus

## Prerequisites

- Admin session with credit transactions permission.
- Migration `0081` applied (tables + `claim_background_job` / `grant_surprise_bonus_user` RPCs), plus `0087` (stale `processing` job reclaim — see [surprise-bonus-stale-job-reclaim.md](../technical/surprise-bonus-stale-job-reclaim.md)).
- **Local + Vercel (default):** Top-up drains the queue **inline** in the same request — status should reach `completed` without waiting for cron.
- **Optional async:** set `SURPRISE_BONUS_SYNC_PROCESS=false` to use `after()` + Vercel cron instead (large campaigns / dedicated worker) — see [cron-process-surprise-bonus.md](../api/cron-process-surprise-bonus.md) / [surprise-bonus-vercel.md](./surprise-bonus-vercel.md). Migration `0087` makes that path self-heal if a batch gets killed mid-run.

Navigate to **Point Transactions** (`/admin/credit/transactions`).

## Surprise Bonus (All Users)

1. Click **Top-up**.
2. Choose **All Users**.
3. Enter **campaign name**, **points amount**, optional note.
4. Submit — by default users are credited before the response (`processedInline: true`); the drawer should show **completed**.
5. Ledger rows use `type: surprise_bonus`; users also get `app_notification` rows.
6. **FCM push** requires `FIREBASE_*` env.

### Force async (cron-only)

```env
SURPRISE_BONUS_SYNC_PROCESS=false
```

Then ensure `/api/cron/process-surprise-bonus` runs (see [surprise-bonus-vercel.md](./surprise-bonus-vercel.md)).

## Top-up a single user

1. Open Top-up → **Select User**.
2. Search and pick a user.
3. Enter amount and note — credited synchronously (no campaign queue).

## Common errors

| Error | Cause |
|-------|--------|
| `No active users found` | All users banned/archived |
| `Campaign name is required` | Empty campaign name |
| `Campaign created but crediting failed: ...` (default inline path) | RPCs missing/broken — re-run `npm run db:migrate`; the campaign row exists but is uncredited, retry the Top-up or fix RPCs and wait for the next reclaim (see below) |
| Progress stuck at 0 / Processing (`SURPRISE_BONUS_SYNC_PROCESS=false`) | Missing `CRON_SECRET`, cron not deployed, or RPCs missing — check Vercel cron logs + `background_jobs`. If a `background_jobs` row is stuck `status = 'processing'` with an old `locked_at` (e.g. an `after()` drain got killed by `maxDuration` mid-batch), it self-heals within ~3 min once migration `0087` is applied — the next claim (cron or another Top-up's `after()`) reclaims it automatically. |
| Jobs `failed` | Check `background_jobs.last_error` |
| Request timeout on large local All Users | Many users + `statement_timeout`; use Cron path or raise DB timeout |
| No phone push | Missing `FIREBASE_*`, or user has no FCM token in `user_devices` |
