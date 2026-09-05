# Admin Top-up Points & Surprise Bonus

## Prerequisites

- Admin session with credit transactions permission.
- Migration `0081` applied (tables + `claim_background_job` / `grant_surprise_bonus_user` RPCs).
- **Local/dev:** no Cron needed — Top-up drains the queue in-process by default.
- **Production (Vercel):** `CRON_SECRET` set; cron `/api/cron/process-surprise-bonus` runs every minute. Submit also starts an `after()` drain. Edge Function optional — see [surprise-bonus-cron.md](./surprise-bonus-cron.md) and [cron-process-surprise-bonus.md](../api/cron-process-surprise-bonus.md).

Navigate to **Point Transactions** (`/admin/credit/transactions`).

## Surprise Bonus (All Users)

1. Click **Top-up**.
2. Choose **All Users**.
3. Enter **campaign name**, **points amount**, optional note.
4. Submit.
   - **Local/dev** (`NODE_ENV !== production`, or `SURPRISE_BONUS_SYNC_PROCESS=true`): API drains `background_jobs` inline and credits users before responding (`processedInline: true`). Campaign should reach `completed` quickly.
   - **Production** (default): API returns with `scheduledAfterResponse: true`; `after()` + Vercel cron credit users. Poll progress in the drawer.
5. Ledger rows use `type: surprise_bonus`; users also get `app_notification` rows.
6. **FCM push** is sent to newly granted users (devices registered via `POST /api/push/register`). Requires `FIREBASE_*` env. Users without tokens still get `app_notification` only.

### Force async locally (test Cron path)

```env
SURPRISE_BONUS_SYNC_PROCESS=false
```

Then either wait for / invoke Vercel cron, or call:

```bash
curl -X POST "http://localhost:3000/api/cron/process-surprise-bonus" \
  -H "Authorization: Bearer $CRON_SECRET"
```

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
