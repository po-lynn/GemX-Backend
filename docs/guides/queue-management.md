# Queue Management — Collaborator Guide

## Prerequisites

Nothing extra — `lib/queue` reuses the existing `background_jobs` table and
`claim_background_job` Postgres function. No new env vars, no new
dependencies.

## Adding a new job type

1. **Write a handler.** A handler receives one claimed job and does the
   work; return normally on success, throw on failure (the queue records
   the failure and retries with backoff, or marks the job `failed` once
   `maxAttempts` is reached). Optionally return a plain object summarizing
   what happened — it's stored on the job row and rendered in an expandable
   detail row under that job on `/admin/queue`, so an admin can see e.g. how
   many records a batch touched without reading logs.

   ```ts
   // features/my-feature/services/process-my-jobs.ts
   import type { ClaimedQueueJob, QueueJobResult } from "@/lib/queue/types"
   import { registerQueueJob } from "@/lib/queue/registry"

   export const MY_JOB_TYPE = "my_feature_batch" as const

   type MyJobPayload = { someId: string }

   // ClaimedQueueJob is intentionally not generic (see lib/queue/types.ts) —
   // cast payload to your feature's shape inside the handler.
   export async function processMyJob(job: ClaimedQueueJob): Promise<QueueJobResult> {
     const payload = job.payload as MyJobPayload
     // ... do the work for payload.someId ...
     return { processed: 1 } // optional — shown as "Processed: 1" on /admin/queue
   }

   registerQueueJob({
     type: MY_JOB_TYPE,
     label: "My Feature",
     handler: processMyJob,
   })
   ```

   The dashboard prettifies keys (`newlyGranted` → "Newly Granted") and
   formats booleans as Yes/No — keep the object flat and JSON-serializable.
   Returning nothing (`Promise<void>`) is fine too; the row's detail then
   shows "No details recorded for this job."

2. **Wire the registration into the shared registry** by adding an import
   to `lib/queue/registrations.ts`:

   ```ts
   import "@/features/my-feature/services/process-my-jobs"
   ```

   Both admin routes (`app/api/admin/queue/*`) import this file, so your
   type automatically shows up on `/admin/queue` once this line exists.

3. **Enqueue and drain** from wherever your feature creates the work
   (typically inline, right after creating whatever record the job is
   about):

   ```ts
   import { enqueueJob } from "@/lib/queue/queue"
   import { drainJobs } from "@/lib/queue/drain"
   import { MY_JOB_TYPE, processMyJob } from "@/features/my-feature/services/process-my-jobs"

   await enqueueJob(MY_JOB_TYPE, { someId: record.id })
   await drainJobs(MY_JOB_TYPE, processMyJob, { maxBatches: 10 })
   ```

   There is no cron — if you enqueue from somewhere other than an
   admin-triggered request, your feature is responsible for draining it
   (inline, or the admin can always fall back to clicking "Retry stuck
   jobs" on `/admin/queue`).

## Showing more than a raw job id on `/admin/queue`

Add an optional `describeJobs` to your `registerQueueJob` call — one
batched lookup for the whole listed page, not a per-row query:

```ts
registerQueueJob({
  type: MY_JOB_TYPE,
  label: "My Feature",
  handler: processMyJob,
  describeJobs: async (jobs) => {
    const ids = [...new Set(jobs.map((j) => (j.payload as MyJobPayload).someId))]
    const rows = await db.select(/* ... */).from(myTable).where(inArray(myTable.id, ids))
    const result = new Map<string, string>()
    for (const job of jobs) {
      const row = rows.find((r) => r.id === (job.payload as MyJobPayload).someId)
      if (row) result.set(job.id, row.someLabel)
    }
    return result
  },
})
```

## Common errors

| Symptom | Cause | Fix |
|---|---|---|
| A job type never appears on `/admin/queue` | Its registration module isn't imported by `lib/queue/registrations.ts` | Add the import |
| A job is stuck `processing` forever | The process that claimed it crashed mid-handler with no thrown JS exception (e.g. a serverless timeout) | `claim_background_job` reclaims any `processing` job locked >3 minutes — the next `drainJobs` call (inline or via "Retry stuck jobs") picks it back up automatically |
| `/admin/queue` returns 403 for an internal staff member | They lack the `queue_management` RBAC permission | Grant it via the admin permissions UI (System group) |
| Draining one type's stuck job also fails other independent jobs of the same type in the same drain call | `drainJobs` aborts the whole drain on the first thrown error, by design (see the technical doc) | Click "Retry stuck jobs" again — the failed job is either backed off or already marked `failed`, and the next call will reach the others |
