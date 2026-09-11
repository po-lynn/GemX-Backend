# Queue jobs: per-batch result detail on /admin/queue

## What changed

`/admin/queue` previously showed one opaque row per batch — a status, a
campaign name, timestamps — with no way to tell what the batch actually did
without reading server logs. This adds a generic `result` column to
`lib/queue`'s job table: any handler can return a plain summary object on
success, which is persisted on the job row and rendered as an expandable
detail row in the admin panel.

Files touched:
- `drizzle/schema/queue-schema.ts` — new nullable `result: jsonb` column on `background_jobs`
- `drizzle/migrations/0090_perpetual_blink.sql` — `ALTER TABLE "background_jobs" ADD COLUMN "result" jsonb;`
- `lib/queue/types.ts` — new `QueueJobResult` type; `QueueJobHandler` may now return `Promise<QueueJobResult | void>`; `QueueJobRow.result: QueueJobResult | null`
- `lib/queue/queue.ts` — `completeJob(jobId, result?)` persists it; `listJobs` selects it
- `lib/queue/drain.ts` — captures a handler's return value and forwards it to `completeJob`
- `features/points/services/process-surprise-bonus-jobs.ts` — returns `{ batchUsers, newlyGranted, alreadyGranted, failed, pushJobEnqueued }`
- `features/points/services/process-surprise-bonus-push-jobs.ts` — returns `{ recipients, sent, failed, invalidTokensRemoved }`
- `app/api/admin/queue/route.ts` — passes `result` through in the job list response
- `components/admin/queue/QueueDashboard.tsx` — expand/collapse chevron per row, rendering `result` as prettified label/value pairs, or a fallback message when `result` is `null`

## Data flow

```
handler(job) returns a plain object (or nothing)
  → drainJobs captures it: const result = await handler(job)
  → completeJob(job.id, result ?? undefined)   // stored as-is, or null
  → GET /api/admin/queue?type=... includes job.result in each job
  → QueueDashboard: clicking a row's chevron toggles a detail row that
    Object.entries(result)'s over the fields, formatting camelCase keys
    ("newlyGranted" -> "Newly Granted") and booleans as Yes/No
```

No new endpoint, no new fetch — `result` rides along the existing `GET
/api/admin/queue?type=<type>` response.

## Schema impact

One additive, nullable column: `background_jobs.result jsonb`. No backfill —
every job that completed before this migration simply has `result: null`,
which the UI treats identically to "this handler didn't return one."

Note for this repo's local dev DB specifically: `npm run db:migrate` failed
here because this database's `__drizzle_migrations` tracking table was far
behind the migrations folder (23 recorded vs. 90 migration files — a
pre-existing drift from this environment's history of using `db:push` for
most schema changes, unrelated to this change). The single `ALTER TABLE ...
ADD COLUMN` was applied directly instead. Anyone deploying through a proper
`db:migrate` pipeline (staging/production) gets it from the generated
migration file as normal.

## Auth & permissions

Unchanged — this is additive data on an existing admin-only endpoint
(`FEATURE_KEYS.QUEUE_MANAGEMENT`).

## Edge cases & known limitations

- A handler is not required to return anything — `Promise<void>` still
  type-checks, and the row simply shows the "No details recorded" fallback.
- `result` is only set in the success path. A job that fails keeps
  `result: null` even after a later successful retry re-sets it — there's no
  history of prior attempts' results, only the most recent completion's.
- The dashboard's formatter is intentionally generic (label-ize keys,
  Yes/No booleans, `toLocaleString()` numbers) rather than per-type —
  keep a handler's result object flat and JSON-serializable so it renders
  sensibly without a custom formatter.
