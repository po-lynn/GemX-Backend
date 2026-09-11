# Queue Management — lib/queue

## What changed

Extracted the generic parts of the Surprise Bonus background-job queue
(`background_jobs` table + `claim_background_job` RPC, both already
type-agnostic) into a reusable `lib/queue/` module, so any feature can
enqueue and drain jobs without re-implementing claim/retry/backoff/admin
visibility. Surprise Bonus itself was refactored onto it with full
functional parity (see `docs/technical/surprise-bonus-queue.md`).

| Path | Role |
|------|------|
| `drizzle/schema/queue-schema.ts` | `backgroundJobs` table (moved from `surprise-bonus-schema.ts`, same underlying `background_jobs` table, no migration) |
| `lib/queue/types.ts` | `QueueJobPayload`, `ClaimedQueueJob`, `QueueJobHandler`, `QueueJobRow`, `QueueJobStatusCounts`, `QueueJobDefinition` |
| `lib/queue/queue.ts` | `enqueueJob`, `claimJob`, `completeJob`, `failOrRetryJob`, `listJobs`, `getJobStatusCounts`, `normalizeRows`, `STALE_AFTER_MS` |
| `lib/queue/drain.ts` | `drainJobs` — claim/handle/complete loop |
| `lib/queue/registry.ts` | `registerQueueJob`, `getQueueJobDefinition`, `listRegisteredJobTypes` — in-code registry, not DB-backed |
| `lib/queue/registrations.ts` | Side-effect-only module importing every feature's registration file |
| `app/api/admin/queue/route.ts` | `GET` — status counts (all types, or one type + its job list) |
| `app/api/admin/queue/retry/route.ts` | `POST { type }` — one drain pass for that type |
| `app/admin/queue/page.tsx`, `components/admin/queue/QueueDashboard.tsx` | Unified admin queue-health page |

## Data flow

**Enqueue + inline drain (how every current consumer uses it):**
```
Feature code
  → enqueueJob(type, payload)              // INSERT background_jobs, status=pending
  → drainJobs(type, handler, { maxBatches })
      → claimJob(type, lockedBy)           // claim_background_job RPC, FOR UPDATE SKIP LOCKED
      → handler(job)                       // feature-specific business logic
      → completeJob(job.id)                // on success
      → on throw: failOrRetryJob(job, message); rethrow — aborts the drain
  → caller decides what a thrown drain error means for its own response
```

**Admin visibility:**
```
/admin/queue mounts → GET /api/admin/queue
  → listRegisteredJobTypes() + getJobStatusCounts(type) per type
Admin selects a type → GET /api/admin/queue?type=<type>
  → getJobStatusCounts(type) + listJobs(type) (+ that type's describeJobs, if any)
Admin clicks "Retry stuck jobs" → POST /api/admin/queue/retry { type }
  → drainJobs(type, definition.handler, { maxBatches: 50 })
```

## Schema impact

None beyond the code move — `background_jobs` (table name, columns, indexes)
is unchanged; `claim_background_job` RPC is unchanged. No new migration.

## Auth & permissions

`GET`/`POST` on `/api/admin/queue*`: `requireAdminOrFeature(request, FEATURE_KEYS.QUEUE_MANAGEMENT)`.
Page: `requireFeatureAccess(FEATURE_KEYS.QUEUE_MANAGEMENT)`. Admin role
always passes; internal staff need the `queue_management` permission
granted via the RBAC permissions UI.

## Edge cases & known limitations

- No cron. A job only drains when a feature calls `drainJobs` itself
  (typically right after `enqueueJob`, inline in the same request) or an
  admin clicks "Retry stuck jobs" on `/admin/queue`.
- `drainJobs` aborts the whole drain on the first handler error (after
  recording it via `failOrRetryJob`) rather than continuing to the next
  job — intentional, matches the pre-existing Surprise Bonus drain
  behavior exactly, since a caller like `enqueueSurpriseBonusForAllUsers`
  depends on the throw to report failure to its own caller.
- `describeJobs` is a per-request batch enrichment hook, not stored — it
  must do its own single batched lookup (not one query per job) to avoid
  N+1 queries when the admin panel lists many jobs.
- The in-code registry (`lib/queue/registry.ts`) only knows about types
  whose registration module has actually been imported in the current
  request's module graph — see `docs/guides/queue-management.md` for how
  to wire a new type into `lib/queue/registrations.ts`.
- **Completion-ordering parity nuance:** the old hand-rolled Surprise Bonus
  queue marked a job `completed` in the DB *before* sending the FCM push;
  the new `lib/queue`-based flow (via `drainJobs`) completes the job
  *after* the handler returns, i.e. after the push attempt. On a normal
  thrown error this doesn't matter — both eventually converge via retry
  semantics. But on a hard process kill *during* the push (not a catchable
  JS exception), the old code left the job `completed` with no push ever
  sent; the new code leaves it `processing`, which the 3-minute
  stale-reclaim then picks up and reprocesses — meaning the push is
  retried (good), but campaign progress counters can double-increment on
  that reprocessing pass (a pre-existing characteristic of the counter
  logic, not introduced by this refactor).
