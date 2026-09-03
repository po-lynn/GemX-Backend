# Admin Top-up Points & Surprise Bonus

## Prerequisites

- Admin session with credit transactions permission.
- Migration `0081` applied (tables + `claim_background_job` / `grant_surprise_bonus_user` RPCs).
- **Local/dev:** no Cron needed — Top-up drains the queue in-process by default.
- **Production:** Edge Function + cron — see [surprise-bonus-cron.md](./surprise-bonus-cron.md).

Navigate to **Point Transactions** (`/admin/credit/transactions`).

## Surprise Bonus (All Users)

1. Click **Top-up**.
2. Choose **All Users**.
3. Enter **campaign name**, **points amount**, optional note.
4. Submit.
   - **Local/dev** (`NODE_ENV !== production`, or `SURPRISE_BONUS_SYNC_PROCESS=true`): API drains `background_jobs` inline and credits users before responding (`processedInline: true`). Campaign should reach `completed` quickly.
   - **Production** (default): API returns immediately; Edge Function batches credit users. Poll progress in the drawer.
5. Ledger rows use `type: surprise_bonus`; users also get `app_notification` rows.
6. **FCM push** is sent to newly granted users (devices registered via `POST /api/push/register`). Requires `FIREBASE_*` env. Users without tokens still get `app_notification` only.

### Force async locally (test Cron path)

```env
SURPRISE_BONUS_SYNC_PROCESS=false
```

Then invoke the Edge Function manually — see [surprise-bonus-cron.md](./surprise-bonus-cron.md).

## Top-up a single user

1. Open Top-up → **Select User**.
2. Search and pick a user.
3. Enter amount and note — credited synchronously (no campaign queue).

## Common errors

| Error | Cause |
|-------|--------|
| `No active users found` | All users banned/archived |
| `Campaign name is required` | Empty campaign name |
| Progress stuck at 0 (production) | Edge Function / cron not running |
| Progress stuck at 0 (local) | RPCs missing — re-run `npm run db:migrate` |
| Jobs `failed` | Check `background_jobs.last_error` |
| Request timeout on large local All Users | Many users + `statement_timeout`; use Cron path or raise DB timeout |
| No phone push | Missing `FIREBASE_*`, or user has no FCM token in `user_devices` |
