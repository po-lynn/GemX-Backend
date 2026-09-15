# Queue job detail page + lifecycle actions

> **UI note:** the detail page moved from `/admin/queue/[id]` to
> `/admin/queue/jobs/[id]`, and gained a slide-over drawer alternative; the
> action buttons were relabeled ("Requeue Job" → "Retry now", "Set to
> 'Done'" → "Mark done", "Cancel Job" → "Cancel job"). The actions, guards,
> and API routes documented below are unchanged — see
> [`docs/technical/queue-console-redesign.md`](queue-console-redesign.md)
> for what moved.

## What changed

`/admin/queue` gained a per-job detail page (`/admin/queue/[id]`) with three
manual lifecycle actions — **Requeue Job**, **Set to 'Done'**, **Cancel
Job** — modeled on Odoo's `queue_job` module record view. This sits on top
of the batch-level "Jobs" list and the "Transactions" flat view built
earlier in the same session ([`queue-transactions-view.md`](queue-transactions-view.md)).

Files touched:

- `lib/queue/types.ts` — widened the status union to a named
  `QueueJobStatus` type (`"pending" | "processing" | "completed" | "failed"
  | "cancelled"`), used by both `QueueJobRow.status` and
  `QueueTransactionRow.state`; added `cancelled` to `QueueJobStatusCounts`.
- `lib/queue/queue.ts` — new `getJob`, `requeueJob`, `setJobDone`,
  `cancelJob`; `getJobStatusCounts` now also counts `cancelled`;
  `deleteJob`'s terminal-state check now includes `cancelled`.
- `app/api/admin/queue/[id]/requeue/route.ts`,
  `app/api/admin/queue/[id]/done/route.ts`,
  `app/api/admin/queue/[id]/cancel/route.ts` — one `POST` route per action.
- `app/admin/queue/[id]/page.tsx` — new Server Component detail page.
- `components/admin/queue/JobDetailView.tsx` — client component: the state
  pipeline, action buttons, field grid, payload/result JSON panels.
- `components/admin/queue/format.ts` — `formatResultLabel`,
  `formatResultValue`, `fmtDate` extracted here so both `QueueDashboard` and
  `JobDetailView` share one implementation instead of duplicating it.
- `components/admin/queue/QueueDashboard.tsx` — each Jobs-table row (and
  each job-sourced Transactions-table row) now links to the detail page;
  `Cancelled` stat chip added; delete-button visibility now includes
  `cancelled`.

## Data flow

```
Server Component: app/admin/queue/[id]/page.tsx
  → requireFeatureAccess(FEATURE_KEYS.QUEUE_MANAGEMENT)   [redirects, not a JSON 401 — this is a page, not an API route]
  → getJob(id)                                            [lib/queue/queue.ts — direct Drizzle select, no API round-trip]
  → notFound() if missing
  → getQueueJobDefinition(job.type).describeJobs([job])   [optional — friendly title, e.g. campaign name]
  → renders <JobDetailView job={...} />                   [client component, receives ISO date strings]

Client Component: components/admin/queue/JobDetailView.tsx
  → POST /api/admin/queue/[id]/requeue  → requeueJob(id)
  → POST /api/admin/queue/[id]/done     → setJobDone(id, { manuallyCompleted: true, by: adminId, at: iso })
  → POST /api/admin/queue/[id]/cancel   → cancelJob(id, "Cancelled by admin (<adminId>)")
  → DELETE /api/admin/queue/[id]        → deleteJob(id)   [already existed]
  → on success: router.refresh() (requeue/done/cancel) or router.push("/admin/queue") (delete)
```

The detail page is a Server Component that queries Drizzle directly (same
pattern as `app/admin/users/[id]/edit/page.tsx`), not a client component
fetching from an API route — the three new API routes exist only for the
client-side *mutations* the action buttons trigger, not for the page's
initial read.

## Schema impact

No migration. `background_jobs.status` (`drizzle/schema/queue-schema.ts`) is
a plain `text` column with no DB-level `CHECK`/enum constraint — it was
already just a documented convention (`/** pending | processing | completed
| failed */`), so adding `"cancelled"` as a new value it's allowed to hold
required no schema change, only widening the TypeScript union and the two
places that special-cased the old 4-value set (`deleteJob`'s `inArray`, and
`QueueDashboard`'s delete-button visibility check). `.lv-status.cancelled`
CSS and its `"Cancelled"` label in `StatusPill` already existed (reused from
elsewhere in the admin panel) — no new styling needed.

## Auth & permissions

Same `FEATURE_KEYS.QUEUE_MANAGEMENT` gate as the rest of `/admin/queue`, via
two different helpers appropriate to context:
- `app/admin/queue/[id]/page.tsx` (a Server Component / page) uses
  `requireFeatureAccess` (`lib/admin-guard.ts`), which redirects rather than
  returning a JSON error.
- The three action routes (API routes) use `requireAdminOrFeature`
  (`lib/api-guard.ts`), which returns `{ error: Response }` for the route to
  forward — this is the same helper every other `/api/admin/queue/*` route
  already uses.

## Why these three actions, and their guards

Modeled on Odoo `queue_job`'s always-visible Requeue Job / Set to 'Done' /
Cancel job buttons, but not copied blindly: GemX's jobs aren't universally
safe to force through every transition, so (per explicit product decision)
the actions are gated asymmetrically:

- **Requeue** (`requeueJob`) — allowed from any status, including
  `completed`, **except** `processing` with a still-fresh lock (same
  `STALE_AFTER_MS` window `claim_background_job`'s own reclaim uses).
  Resets `status: "pending"`, clears the lock and `lastError`, sets
  `availableAt: now`. Requeuing a completed job is safe because every
  Surprise Bonus handler (`grant_surprise_bonus_user`) is idempotent per
  `(user, campaign)` via `point_transaction`'s unique index — it just
  re-confirms "already granted" for its users and does nothing further. The
  one exclusion exists because `pending` is the one status
  `claim_background_job` looks for: requeuing a job a live drain pass is
  still genuinely executing would let a second worker claim and run the
  same batch concurrently. Grant idempotency prevents double-crediting, but
  `processSurpriseBonusJob`'s plain read-modify-write updates to
  `surpriseBonusCampaign.processedUsers`/`successCount`/`failedCount` (no
  atomic increment or row lock) are *not* similarly protected, so two
  concurrent workers racing there would still corrupt those progress
  counters — this was caught in review and fixed by adding the guard rather
  than accepting the risk. The UI mirrors this guard: the **Requeue Job**
  button disables itself (`isFreshlyProcessing` in `JobDetailView.tsx`)
  under the identical condition.
- **Set to 'Done'** (`setJobDone`) — allowed from **any** status. Force-sets
  `status: "completed"`, overwriting `result` with `{ manuallyCompleted:
  true, by: <adminId>, at: <ISO timestamp> }` so it's visibly distinguishable
  from a handler's real return value on the Transactions/Jobs view.
- **Cancel** (`cancelJob`) — allowed from any status **except**
  `completed` (enforced in one atomic query via `WHERE id = ? AND status !=
  'completed'`, avoiding a check-then-act race, the same pattern
  `deleteJob` already used). Cancelling finished work doesn't make sense, so
  this is the one transition intentionally blocked. Sets `status:
  "cancelled"`, `lastError: "Cancelled by admin (<adminId>)"`.

None of the three prevent acting on a job that a live worker might currently
be processing — same inherent risk Odoo's own buttons carry, accepted here
as an admin-operated override tool.

## Edge cases & known limitations

- No confirmation dialog on **Requeue** (matches "Retry stuck jobs", which
  also has none); **Set to 'Done'**, **Cancel**, and **Delete** each show a
  `window.confirm` first, since they either bypass real processing or stop
  it.
- `cancelJob` returning `false` conflates "job not found" with "job is
  already completed" into a single `404` — mirrors the existing `DELETE
  /api/admin/queue/[id]` convention rather than introducing an inconsistent
  new status code for just this one route.
- The state-pipeline stepper on the detail page only renders
  Pending → Processing → Completed as the happy path, with Failed/Cancelled
  shown as an alternate terminal step — there's no "Wait Dependencies" /
  "Enqueued" / "Started" distinction like Odoo's, because `background_jobs`
  genuinely has no dependency-graph or sub-states to represent; collapsing
  those into "Processing" reflects what's actually tracked, not a
  simplification of something we do track.
- No chatter/comment thread (Odoo's "Send message" / "Log note" /
  "Activities") — GemX has no generic per-record audit-log or comment
  system to hook into, and building one is out of scope for this change.

## Auto-delete on completion

**What changed.** A job's `background_jobs` row is now deleted the instant
it reaches `completed`, instead of being kept with `status: "completed"`
until an admin manually deletes it. This applies to every registered job
type, via both paths that produce a `completed` status:

- `completeJob(jobId)` (`lib/queue/queue.ts`) — called by `drainJobs`
  (`lib/queue/drain.ts`) after a handler returns successfully. Previously
  `UPDATE ... SET status = 'completed', result = <handler's return value>`;
  now `DELETE FROM background_jobs WHERE id = ...`. The handler's return
  value is no longer persisted anywhere — `drainJobs` calls `handler(job)`
  and discards what it returns, since whatever the handler produced (a
  ledger entry, a campaign update, a push notification) was already
  committed to its own table before returning.
- `setJobDone(id)` (`lib/queue/queue.ts`) — the **Mark done** manual
  override. Previously updated the row and overwrote `result` with `{
  manuallyCompleted: true, by: <adminId>, at: <ISO timestamp> }`; now
  deletes the row unconditionally (any prior status), same as `deleteJob`.
  No record of which admin forced it, or when, survives — this matches the
  trade-off manual **Delete** already made.

Both functions dropped their `result`/`QueueJobResult` parameter — nothing
downstream reads it anymore. `lib/queue/drain.ts` no longer captures the
handler's return value at all (`await handler(job); await completeJob(job.id)`).

Files touched: `lib/queue/queue.ts`, `lib/queue/drain.ts`,
`app/api/admin/queue/[id]/done/route.ts`,
`components/admin/queue/useJobActions.ts` (confirm/success copy),
`components/admin/queue/JobActionsBar.tsx` (tooltip copy),
`components/admin/queue/JobDrawer.tsx` and
`components/admin/queue/JobDetailView.tsx` (a successful **Mark done** now
closes the drawer / navigates back to `/admin/queue`, same as **Delete**,
instead of reloading a job that no longer exists).

**Why.** Product decision: once a job has done its job, its queue-tracking
row has no further use, and completed test/production batches were
cluttering the admin queue views. Scoped to `completed` only —
`failed`/`cancelled` rows are untouched and still need a manual **Delete**,
so there's always something to look at when investigating a problem.

**Schema impact.** None — no migration. This is a query-shape change only.

**Known limitation — dashboard metrics that count completed jobs.**
`getPlatformQueueSummary` and `getQueueTypeSummary` (`lib/queue/queue.ts`)
compute several fields with `WHERE status = 'completed' AND completed_at >
now() - interval '24 hours'` (or `'48 hours'` for the prior-period
comparison) directly against `background_jobs`. Now that a completed row is
deleted in the same call that would have set `completed_at`, that query
window is always empty, which structurally breaks these fields for every
job type, not just the ones an admin has been testing:

- `counts.completed` (lifetime) and `completed24h` — always ~0.
- `completed24hDeltaPct` — always `null` (division by a zero prior-window
  count is already guarded).
- `p95RunTimeMs` — always `null` (no completed rows in the window to
  percentile over).
- `throughput` (the 8-hour sparkline) — always all-zero.
- `health` (`classifyQueueHealth`) — the `idle` branch
  (`completed24h === 0 && pending === 0 && processing === 0`) now fires for
  any queue that's simply caught up, not just a genuinely idle one.
- **`failureRatePct` is the sharp edge, not just "blank."**
  `processed24h = completed24h + failed24h` collapses to `≈ failed24h` once
  `completed24h` is structurally ~0, so `failureRatePct` swings to ≈100%
  the moment `failed24h > 0` — even if thousands of jobs of that type
  succeeded (and were deleted) in the same window. The **Failure rate** KPI
  card on `/admin/queue` (`components/admin/queue/QueueOverview.tsx`) reads
  this value directly and compares it against `thresholds.failureRateSloPct`,
  so a single failed job among many successes now renders as an SLO breach.

This was an explicit, disclosed trade-off (product decision: immediate
delete, all job types) rather than an oversight, but it means these fields
are no longer meaningful signals and the "Failure rate" card in particular
can misrepresent a healthy queue as failing. Fixing it properly needs a
separate source of truth for completion counts (e.g. a lightweight
append-only counters table or log, written alongside the delete) since the
job row itself no longer survives long enough to be counted — out of scope
here; flagged for a follow-up if accurate failure-rate reporting is needed.
