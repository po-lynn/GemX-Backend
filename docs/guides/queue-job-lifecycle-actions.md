# Queue job detail page & actions

> **UI note:** button labels and the route below are from before the Queue
> Console redesign — see
> [`docs/guides/queue-console.md`](queue-console.md) for the current
> screens. The actions, guards, and error messages themselves are unchanged.

## Prerequisites

- Admin session with the `QUEUE_MANAGEMENT` RBAC feature — same gate as the
  rest of `/admin/queue`.
- No new env vars or migrations.

## Using it end-to-end

1. From **Admin → Queue**, either the **Jobs** tab or the **Transactions**
   tab: click the small open-in-new icon next to any job row (Jobs tab), or
   click a job-sourced row's description (Transactions tab). Both take you
   to `/admin/queue/<job-id>`.
2. The detail page shows: the state pipeline (Pending → Processing →
   Completed, with Failed/Cancelled as an alternate terminal step), the
   job's fields (attempts, locked-at/by, created/completed timestamps), its
   last error (if any), and its raw `payload` / `result` as JSON.
3. Three buttons act on this one job, regardless of what "Retry stuck jobs"
   on the list view would do (that retries the whole *type*, not one job):
   - **Requeue Job** — puts it back to `pending` so the next drain pass
     (or a Top-up submission's inline drain) picks it up again. No
     confirmation prompt. Disabled while the job is `processing` with a
     lock that hasn't gone stale yet (a worker may genuinely still be
     running it) — wait for it to either finish or go stale (~3 min).
   - **Set to 'Done'** — force-completes it without running its handler,
     then **removes it from the queue** (same as Delete). Confirms first.
     Use this only when you've verified by other means that the job's work
     is actually finished (e.g. you manually credited the remaining users)
     — it does **not** run anything, it just marks the row done and clears
     it out.
   - **Cancel Job** — stops it being retried. Confirms first. Disabled once
     the job is already `completed` (you can't cancel finished work).
4. **Delete** (only shown once the job is `failed`/`cancelled` — a
   `completed` job is deleted automatically, see below) removes the
   tracking row — same as the Jobs tab's delete button.

## Completed jobs disappear automatically

As of this change, a job's row is deleted the moment it reaches
`completed` — whether that's the normal drain-worker success path or a
manual **Set to 'Done'**. This applies to every job type, not just the one
you're looking at. If you had a job's detail page or drawer open when it
completed, the next refresh/action will treat it as gone (drawer closes /
detail page redirects back to `/admin/queue`) — that's expected, not an
error.

A practical consequence: the Queue Console's completed-job counts,
failure-rate %, p95 run time, and throughput sparkline are no longer
reliable (they're computed from rows that no longer exist once completed).
See "Known limitation" in
[`docs/technical/queue-job-lifecycle-actions.md`](../technical/queue-job-lifecycle-actions.md#known-limitation--dashboard-metrics-that-count-completed-jobs)
before trusting the **Failure rate** card during an incident — a spike
there can mean "one job failed among many successes," not "the queue is
mostly failing."

## Common errors

| Error | Cause |
|-------|-------|
| "Job not found" on Set to Done | The job id in the URL doesn't exist (e.g. it was deleted from another tab) — refresh the Queue list. |
| "Job not found, or still actively processing" on Requeue | Either the id doesn't exist, or the job is `processing` with a fresh lock — a live worker may still be on it. Refresh in a few minutes; once the lock goes stale the button re-enables. |
| "Job not found, or already completed" on Cancel | Either the id doesn't exist, or the job already finished — cancelling a completed job isn't allowed (see [`queue-job-lifecycle-actions.md` in docs/technical](../technical/queue-job-lifecycle-actions.md#why-these-three-actions-and-their-guards)). |
| Set to 'Done' didn't actually process anything | Expected — it force-marks the row done without running the handler. If you need the real work done, use **Requeue Job** instead so the handler actually runs. |
