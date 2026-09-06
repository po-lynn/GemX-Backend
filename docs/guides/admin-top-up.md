# Admin Top-up Points & Surprise Bonus

## Prerequisites

- Admin session with credit transactions permission.
- Migration `0081` applied (tables + `claim_background_job` / `grant_surprise_bonus_user` RPCs).
- **Local + Vercel (default):** Top-up drains the queue **inline** in the same request — status should reach `completed` without waiting for cron.
- **Optional async:** set `SURPRISE_BONUS_SYNC_PROCESS=false` and use [cron-process-surprise-bonus.md](../api/cron-process-surprise-bonus.md) / [surprise-bonus-vercel.md](./surprise-bonus-vercel.md).

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
| Progress stuck at 0 / Processing (production) | Missing `CRON_SECRET`, cron not deployed, or RPCs missing — check Vercel cron logs + `background_jobs` |
| Progress stuck at 0 (local) | RPCs missing — re-run `npm run db:migrate` |
| Jobs `failed` | Check `background_jobs.last_error` |
| Request timeout on large local All Users | Many users + `statement_timeout`; use Cron path or raise DB timeout |
| No phone push | Missing `FIREBASE_*`, or user has no FCM token in `user_devices` |
