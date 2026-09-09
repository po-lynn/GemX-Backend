# Queue Management — Design

## Motivation

Surprise Bonus ("Top-up → All Users") already runs on a real DB-backed job
queue: the `background_jobs` table (`type`, `payload` jsonb, `status`,
`attempts`/`maxAttempts`, `availableAt`, `lockedAt`/`lockedBy`, `lastError`)
and the `claim_background_job(type, lockedBy)` Postgres RPC
(`FOR UPDATE SKIP LOCKED`, with stale-lock reclaim) are already generic —
parameterized by job `type`, not specific to surprise bonus.

What's *not* generic is everything around them: the drain loop, the
retry/backoff bookkeeping, the admin listing/status-count queries, and the
admin panel are all hardcoded to one job type
(`features/points/services/process-surprise-bonus-jobs.ts`,
`features/points/db/surprise-bonus.ts`,
`features/points/components/SurpriseBonusJobsPanel.tsx`). The next feature
that needs background job processing would have to duplicate all of that.

This spec extracts the generic parts into a reusable `lib/queue/` module and
migrates Surprise Bonus onto it, so a future feature only has to: write a
handler function, register it, and reuse the same admin visibility page.

## Goals

- A `lib/queue/` module any feature can call to enqueue jobs, drain them,
  and expose admin visibility, without writing its own claim/retry/backoff
  loop or admin table query.
- Surprise Bonus refactored to run on this module with **full functional
  parity** with today — including FCM push sends, in-app notifications,
  idempotent ledger grants, campaign progress counters, and stale-job
  reclaim. No behavior regression.
- One unified `/admin/queue` admin page for queue health across all
  registered job types, replacing the embedded `SurpriseBonusJobsPanel`.
- Zero new SQL migrations. The `background_jobs` table and
  `claim_background_job` RPC are reused unchanged.

## Non-goals

- No cron / scheduled draining. Processing stays inline-on-enqueue plus a
  manual "Retry stuck jobs" admin action — exactly today's model. A future
  feature that genuinely needs scheduled draining can add a
  narrowly-scoped cron for itself later; building a generic one now has no
  concrete consumer and is explicitly deferred (YAGNI).
- No change to `background_jobs` schema, `claim_background_job`, or
  `grant_surprise_bonus_user`.
- No job priority, concurrency limits per type, or distributed worker
  process. Still no Redis/BullMQ — same DB-backed model as today.
- No multi-tenant / cross-project queue — single Postgres instance, as now.

## Architecture

### `lib/queue/` (new)

The only code allowed to touch the `background_jobs` table directly. All
features go through this module.

**`lib/queue/types.ts`**
```ts
export type QueueJobPayload = Record<string, unknown>

export type ClaimedQueueJob<TPayload extends QueueJobPayload = QueueJobPayload> = {
  id: string
  type: string
  payload: TPayload
  attempts: number
  maxAttempts: number
}

export type QueueJobHandler<TPayload extends QueueJobPayload = QueueJobPayload> =
  (job: ClaimedQueueJob<TPayload>) => Promise<void>

export type QueueJobRow = {
  id: string
  type: string
  payload: QueueJobPayload
  status: "pending" | "processing" | "completed" | "failed"
  attempts: number
  maxAttempts: number
  availableAt: Date
  lockedAt: Date | null
  lockedBy: string | null
  lastError: string | null
  createdAt: Date
  completedAt: Date | null
  isStale: boolean
}

export type QueueJobStatusCounts = {
  pending: number
  processing: number
  completed: number
  failed: number
  stale: number
}

export type QueueJobDefinition = {
  type: string
  label: string
  handler: QueueJobHandler
  /** Batch-enrich rows for the admin panel (e.g. join a campaign name). Called once per page load, not per row. */
  describeJobs?: (jobs: QueueJobRow[]) => Promise<Map<string, string>>
}
```

**`lib/queue/queue.ts`** — core DB operations, generic over `type`:
- `enqueueJob(type: string, payload: QueueJobPayload, opts?: { maxAttempts?: number; availableAt?: Date }): Promise<{ id: string }>`
- `claimJob(type: string, lockedBy: string): Promise<ClaimedQueueJob | null>` — wraps `claim_background_job` (unchanged RPC), normalizes the raw SQL result (postgres-js array / RowList / `{rows}` shapes — the `asRows` normalizer currently duplicated in `process-surprise-bonus-jobs.ts` moves here).
- `completeJob(jobId: string): Promise<void>`
- `failOrRetryJob(job: ClaimedQueueJob, error: string, opts?: { backoffMinutes?: (attempts: number) => number }): Promise<void>` — generalizes today's `min(attempts * 2, 30)` backoff (kept as the default), marks `failed` once `attempts >= maxAttempts`.
- `listJobs(type: string, limit?: number): Promise<QueueJobRow[]>` — generic version of `listSurpriseBonusJobs`, no join.
- `getJobStatusCounts(type: string): Promise<QueueJobStatusCounts>` — generic version of `getSurpriseBonusJobStatusCounts`.
- `STALE_AFTER_MS` exported constant (3 minutes), matching the reclaim window baked into `claim_background_job` (migration `0087`) — single source of truth for the "is this row stale" computation used by both `listJobs` and `getJobStatusCounts`.

**`lib/queue/drain.ts`**
- `drainJobs(type: string, handler: QueueJobHandler, opts?: { maxBatches?: number; lockedBy?: string }): Promise<{ batches: number }>` — loop: `claimJob` → `handler(job)` → `completeJob`; on throw, records the failure via `failOrRetryJob` (bookkeeping: backoff or terminal `failed`) and **rethrows**, aborting the drain — this exactly mirrors today's `drainSurpriseBonusJobs`/`processOneSurpriseBonusBatch`. (An earlier draft of this spec proposed swallowing the error and continuing to the next job instead; that was reverted because `enqueueSurpriseBonusForAllUsers` depends on the throw propagating out of the inline drain to report "crediting failed" to the admin — silently continuing would turn that into a false-positive success response. A future feature that genuinely wants continue-past-error draining can request it explicitly; not building it now per YAGNI.)

**`lib/queue/registry.ts`**
- `registerQueueJob(def: QueueJobDefinition): void` — in-code registry (a module-level `Map`), not DB-backed.
- `getQueueJobDefinition(type: string): QueueJobDefinition | undefined`
- `listRegisteredJobTypes(): { type: string; label: string }[]`

**`lib/queue/registrations.ts`**
- Side-effect-only module that imports every feature's registration file, so any route needing the full registry (the admin routes) imports this one file. New job types are added here.

### Schema

- Move the `backgroundJobs` Drizzle table definition from
  `drizzle/schema/surprise-bonus-schema.ts` into a new
  `drizzle/schema/queue-schema.ts`. The underlying Postgres table name
  (`background_jobs`) is unchanged — this is a pure code move, **no
  migration**.
- `drizzle/schema.ts`: add `export * from "./schema/queue-schema"`. While
  touching this file, remove the pre-existing accidental duplicate line
  (`surprise-bonus-schema` is currently exported twice, lines 12 and 28) —
  a one-line incidental cleanup directly adjacent to the edit.
- `SURPRISE_BONUS_JOB_TYPE` stays in `surprise-bonus-schema.ts` (feature-owned
  identity, not a queue concern).

## Processing model

Inline-only, matching today exactly:
- A feature enqueues via `enqueueJob(type, payload)` and, in the same
  request, calls `drainJobs(type, handler, { maxBatches })` to process
  synchronously before responding (as `enqueueSurpriseBonusForAllUsers`
  does today).
- Recovery for stranded jobs is the existing two-layer story, unchanged:
  `claim_background_job`'s 3-minute stale-processing reclaim, plus the
  admin "Retry stuck jobs" button running one more `drainJobs` pass.
- No cron. No `vercel.json` change.

## Admin UI & permissions

- New page: `app/admin/queue/page.tsx`, linked from `AdminSidebar.tsx` /
  `AdminSidebarSheet.tsx` as "Queue".
- `GET /api/admin/queue?type=<type>` — status counts (via
  `getJobStatusCounts`) for the selected type, or for all registered types
  when no `type` is given (drives the top-level type list before drilling
  in); `listJobs(type)` for the selected type's recent-jobs table, enriched
  via that type's `describeJobs` hook if present.
- `POST /api/admin/queue/retry { type }` — `drainJobs(type, handler, { maxBatches: 50 })`, same semantics as today's per-feature retry button.
- Both routes gated by `requireAdminOrFeature(request, FEATURE_KEYS.QUEUE_MANAGEMENT)`.
- New RBAC key: `FEATURE_KEYS.QUEUE_MANAGEMENT = "queue_management"` in
  `features/rbac/feature-keys.ts`, under a new `"System"` group — consistent
  with the existing 35-guarded-admin-page RBAC convention rather than
  reusing the points-specific `CREDIT_TRANSACTIONS` key.
- UI reuses existing `components/admin/list-view/StatusPill.tsx` (already
  has `processing`/`completed` labels) and the existing admin list-view
  table conventions for visual consistency with the rest of the admin
  panel.
- Removed: `features/points/components/SurpriseBonusJobsPanel.tsx`, its
  embed in `app/admin/credit/transactions/page.tsx`, and the two
  now-superseded routes `app/api/admin/points/surprise-bonus/jobs/route.ts`
  and `app/api/admin/points/surprise-bonus/jobs/retry/route.ts`.

## Surprise Bonus refactor — functional parity

Everything the feature does today keeps working, with identical behavior:

- `features/points/services/process-surprise-bonus-jobs.ts`: the batch
  loop (up to 100 users), `grant_surprise_bonus_user` RPC calls (idempotent
  ledger insert + `app_notification` row via the unique index on
  `point_transaction`), campaign progress counters, and self-chaining the
  next batch — all unchanged in logic, just re-homed as the body of a
  `QueueJobHandler` function (`processSurpriseBonusJob`) instead of the
  bespoke `processOneSurpriseBonusBatch`. Self-chaining uses the generic
  `enqueueJob` instead of a raw `db.insert(backgroundJobs)`.
- **Push notifications are explicitly preserved**: `sendSurpriseBonusPushToUsers`
  (FCM) still fires from inside the handler after each batch, only for
  newly-granted users, and a push failure still never undoes the ledger or
  in-app notification — unchanged semantics, just called from the new
  handler instead of the old function.
- `processSurpriseBonusJob` is registered once via
  `registerQueueJob({ type: SURPRISE_BONUS_JOB_TYPE, label: "Surprise Bonus", handler: processSurpriseBonusJob, describeJobs })`
  at module load, imported by `lib/queue/registrations.ts`.
- `describeJobs` (new, in `features/points/db/surprise-bonus.ts`): one
  batched query joining `surprise_bonus_campaign` by
  `payload->>'campaignId'` for the set of jobs being listed — preserves the
  campaign-name column the old `listSurpriseBonusJobs` LEFT JOIN provided,
  without an N+1 per-row lookup.
- `features/points/services/enqueue-surprise-bonus.ts`: swaps
  `enqueueSurpriseBonusBatchJob`/`drainSurpriseBonusJobs` calls for the
  generic `enqueueJob`/`drainJobs`. Campaign creation and `maxBatches`
  sizing from user count are unchanged.
- `features/points/db/surprise-bonus.ts`: `enqueueSurpriseBonusBatchJob`,
  `listSurpriseBonusJobs`, and `getSurpriseBonusJobStatusCounts` are
  removed (superseded by `lib/queue` + the new `describeJobs` hook).
  `countActiveUsers`, `createSurpriseBonusCampaign`,
  `markSurpriseBonusCampaignProcessing`, and `getSurpriseBonusCampaignById`
  are unchanged.
- Stale-job reclaim (migration `0087`'s 3-minute window) is unaffected — it
  lives entirely in `claim_background_job`, which the generic `claimJob`
  wraps unchanged.

Net effect: identical admin-visible behavior (create campaign → inline
drain → push → completed), identical recovery story, identical idempotency
guarantees — running through the shared library instead of duplicated
code, visible on `/admin/queue` instead of an embedded panel.

## Testing

- `tests/unit/queue.test.ts` — `lib/queue` core: enqueue, claim (mocked RPC
  result shapes), complete, failOrRetry backoff math and the
  max-attempts → `failed` transition, `listJobs`'s stale-flag edge cases
  (ported from the deleted `surprise-bonus-jobs-db.test.ts`), and the drain
  loop's throw-and-abort-with-bookkeeping behavior. Mocked Drizzle.
- `tests/api/admin/queue.test.ts` — `GET`/`POST retry` routes: mocked
  `requireAdminOrFeature` (admin, RBAC-granted internal, forbidden), mocked
  `lib/queue` calls.
- Update `tests/unit/process-surprise-bonus-jobs.test.ts` and
  `tests/unit/enqueue-surprise-bonus.test.ts` for the refactored call sites
  (`processSurpriseBonusJob` handler, `lib/queue`'s `enqueueJob`/`drainJobs`).
  `tests/api/admin/surprise-bonus.test.ts` and
  `tests/unit/surprise-bonus-stale-job-reclaim.test.ts` need no changes —
  neither touches the refactored internals directly. Delete
  `tests/api/admin/surprise-bonus-jobs.test.ts` and
  `tests/unit/surprise-bonus-jobs-db.test.ts` (they test the removed
  `jobs/route.ts`, `jobs/retry/route.ts`, and
  `listSurpriseBonusJobs`/`getSurpriseBonusJobStatusCounts` directly).
- `npm run test` must pass in full before this is considered done.

## Documentation

- `docs/technical/queue-management.md` — new library architecture (this
  spec's Architecture section, adapted).
- `docs/guides/queue-management.md` — collaborator guide: how to register a
  new job type (write a handler, call `registerQueueJob`, add the import to
  `lib/queue/registrations.ts`), how to enqueue and drain, common errors.
- `docs/api/admin-queue.md` — `GET`/`POST` contract for the two new admin
  routes.
- Update `docs/technical/surprise-bonus-queue.md` to reflect the refactor
  (file table + data flow now route through `lib/queue`).
- `docs/technical/surprise-bonus-jobs-panel.md` gets an "Update" note at
  the top (matching the existing convention in
  `fix-surprise-bonus-vercel-processing.md`) marking the panel superseded
  by `/admin/queue`, rather than being deleted — preserves history the way
  other superseded-feature docs in this repo already do.

## Edge cases & known limitations

- `describeJobs` is a per-listing batch call, not stored — if a campaign is
  deleted, its jobs still list with no name, same as today's
  `campaignName: null` behavior.
- The admin "Retry stuck jobs" action runs a real drain pass, not a
  dry-run — clicking it for a type with genuine pending work processes
  that work, same as today.
- Because there is no cron, a job type whose only enqueue path is a
  non-admin trigger (not applicable to any feature today) would only drain
  via an admin visiting `/admin/queue` and clicking retry. Acceptable per
  the Non-goals section; revisit if a future feature needs otherwise.
- A queue with multiple independent pending jobs of the same type where one
  throws still has the same limitation today's `drainSurpriseBonusJobs` has:
  the whole drain call aborts on the first error, leaving the rest
  unprocessed until the next drain attempt (inline retry or manual "Retry
  stuck jobs"). Preserved intentionally for functional parity — see the
  `drainJobs` note above.
