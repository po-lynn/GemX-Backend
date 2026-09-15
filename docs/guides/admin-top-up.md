# Admin Top-up Points & Surprise Bonus

## Prerequisites

- Admin session with credit transactions permission.
- Migration `0081` applied (tables + `claim_background_job` / `grant_surprise_bonus_user` RPCs), plus `0087` (stale `processing` job reclaim — see [surprise-bonus-stale-job-reclaim.md](../technical/surprise-bonus-stale-job-reclaim.md)).
- Surprise Bonus is **admin-triggered only** — there is no schedule or cron. An admin clicks Top-up whenever they want to run a campaign, and the queue drains **inline** in that same request (local and Vercel alike) — no separate cron or worker to keep running.

Navigate to **Point Transactions** (`/admin/credit/transactions`).

## Surprise Bonus (All Users)

1. Click **Top-up**.
2. Choose **All Users**.
3. Enter **campaign name**, **points amount**, optional note.
4. Submit — by default users are credited before the response (`processedInline: true`); the drawer should show **completed**.
5. Ledger rows use `type: surprise_bonus`; users also get `app_notification` rows.
6. **FCM push** requires `FIREBASE_*` env.

## Background Jobs panel

Below the transactions table on the same page, **Surprise Bonus — Background Jobs** shows every `background_jobs` row (status counts + the 100 most recent), with a **STALE** tag on any `processing` job whose lock is >3 min old. Use **Retry stuck jobs** to run one drain pass on demand instead of submitting a throwaway Top-up — see [surprise-bonus-jobs-panel.md](../technical/surprise-bonus-jobs-panel.md). For per-user detail (which specific credits already landed vs. which batch is stuck), switch to the **Transactions** tab there — see [queue-transactions.md](queue-transactions.md). To act on one stuck batch directly (requeue it, force it done, or cancel it), open its detail page — see [queue-job-lifecycle-actions.md](queue-job-lifecycle-actions.md).

## Top-up a single user

1. Open Top-up → **Select User**.
2. Search and pick a user.
3. Enter amount and note — credited synchronously (no campaign queue).

## Common errors

| Error | Cause |
|-------|--------|
| `No active users found` | All users banned/archived |
| `Campaign name is required` | Empty campaign name |
| `Campaign created but crediting failed: ...` | RPCs missing/broken — re-run `npm run db:migrate`; the campaign row exists but is uncredited, retry the Top-up or fix the RPCs |
| Progress stuck at 0 / Processing | A very large user base hit the 60s `maxDuration` mid-batch, stranding a `background_jobs` row at `status = 'processing'`. Once its `locked_at` is >3 min old (migration `0087`), click **Retry stuck jobs** in the Background Jobs panel below (or submit any Top-up — its inline drain reclaims it too). |
| Jobs `failed` | Check `background_jobs.last_error` |
| No phone push | Missing `FIREBASE_*`, or user has no FCM token in `user_devices` |
