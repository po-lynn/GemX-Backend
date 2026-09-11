# Surprise Bonus: split push delivery into its own queue job type

## What changed

Point crediting for Surprise Bonus was already a registered `lib/queue` job
type (`surprise_bonus_batch`), visible and manageable on `/admin/queue`. FCM
push delivery, however, was a plain synchronous call
(`sendSurpriseBonusPushToUsers`) made from inside that same handler, with
its result swallowed — a total FCM failure was only ever `console.error`'d,
never surfaced as a job status, never retryable, never something an admin
could see or delete.

This change gives push delivery its own registered queue job type,
`surprise_bonus_push_batch`, so it gets the same monitoring/retry/delete
surface as crediting, without ever being able to block or retry a credit
batch.

Files touched:
- `drizzle/schema/surprise-bonus-schema.ts` — added `SURPRISE_BONUS_PUSH_JOB_TYPE = "surprise_bonus_push_batch"`
- `features/points/services/process-surprise-bonus-push-jobs.ts` — **new**: `processSurpriseBonusPushJob` (the registered handler) and `describeSurpriseBonusPushJobs`
- `features/points/services/process-surprise-bonus-jobs.ts` — `processSurpriseBonusJob` now enqueues a push job per batch instead of calling `sendSurpriseBonusPushToUsers` directly
- `features/points/services/enqueue-surprise-bonus.ts` — drains `surprise_bonus_push_batch` inline right after the credit drain, in a try/catch that logs but never fails the response
- `lib/queue/registrations.ts` — imports the new handler module so it registers
- `docs/technical/surprise-bonus-queue.md`, `docs/api/admin-surprise-bonus.md`, `docs/guides/surprise-bonus-push-jobs.md` — updated/added to match

## Data flow

Before:
```
processSurpriseBonusJob (per batch)
  → grant_surprise_bonus_user() per user
  → sendSurpriseBonusPushToUsers(newlyGranted)   // inline, errors swallowed to a console.error
  → chain next batch or mark campaign completed
```

After:
```
processSurpriseBonusJob (per batch)                          [surprise_bonus_batch]
  → grant_surprise_bonus_user() per user
  → enqueueJob(SURPRISE_BONUS_PUSH_JOB_TYPE, { campaignId, campaignName, pointsPerUser, userIds })
  → chain next batch or mark campaign completed

enqueueSurpriseBonusForAllUsers, after the credit drain finishes:
  drainJobs(SURPRISE_BONUS_PUSH_JOB_TYPE, processSurpriseBonusPushJob)   [surprise_bonus_push_batch]
    → processSurpriseBonusPushJob: sendSurpriseBonusPushToUsers(userIds)
      → throws only if sent === 0 && failed > 0 (a genuine total-send failure)
      → a batch where nobody has a device (sent: 0, failed: 0) is not a failure
  → caught here: logged, response still returns { success: true, ... }
```

Net effect for the admin-facing response: identical on the happy path
(`processedInline: true`, same shape). The only behavioral change is that a
push failure that used to be invisible now shows up as a `failed` (or
backed-off `pending`) row under the "Surprise Bonus Push" type on
`/admin/queue`.

## Schema impact

None. `SURPRISE_BONUS_PUSH_JOB_TYPE` is a new string value stored in the
existing `background_jobs.type` column — no migration, no new table.

## Auth & permissions

Unchanged. `POST /api/admin/points/surprise-bonus` still gates on
`FEATURE_KEYS.CREDIT_TRANSACTIONS`; `/admin/queue` and its API routes still
gate on `FEATURE_KEYS.QUEUE_MANAGEMENT` — this is a different permission on
purpose (crediting vs. queue operations), unchanged by this work.

## Edge cases & known limitations

- A push job's payload carries `campaignName` and `pointsPerUser` directly
  (copied from the campaign row at the time the credit batch ran), rather
  than joining back to `surprise_bonus_campaign` — so `describeJobs` for
  this type needs no DB query, but it also means if a campaign is renamed
  after its push jobs are enqueued (there's no UI for that today), already-
  queued push jobs keep the old name.
- `drainJobs` aborts its whole pass on the first thrown error. Since credit
  and push are now separate `drainJobs` calls, a push failure only aborts
  *remaining push batches in that request* — it never touches the credit
  drain, which has already fully completed by the time push draining
  starts. Any push batches left un-drained by that abort simply stay
  `pending`/`failed` and are picked up by the next campaign's inline push
  drain or an admin's "Retry stuck jobs" click.
- The number of push jobs created per campaign equals the number of credit
  batches that had at least one newly-granted user (not `already_granted`)
  — so `maxBatches` for the push drain reuses the same value computed for
  the credit drain; it's always an upper bound, never a shortfall.
