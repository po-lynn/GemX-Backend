# Admin Top-up — Select Recipient / Surprise Bonus

See [surprise-bonus-queue.md](./surprise-bonus-queue.md) for the async All Users architecture.

## What changed

- **All Users** now enqueues a Surprise Bonus campaign (PostgreSQL `background_jobs`) instead of synchronous credits.
- **Select User** remains a sync admin top-up via `adminTopUpUserPointsAction`.
- Notifications for All Users use `app_notification` (not chat).

## Files

- UI: `features/points/components/PointActionButtons.tsx`
- APIs: `app/api/admin/points/surprise-bonus/`
- DB: `features/points/db/surprise-bonus.ts`, migration `0081_surprise_bonus_queue.sql`
