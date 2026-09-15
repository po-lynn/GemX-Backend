# Queue "Transactions" view

> **UI note:** the **Transactions** tab described below was removed from
> `/admin/queue/[type]` — see ["Transactions tab removed from
> UI"](../technical/queue-console-redesign.md#transactions-tab-removed-from-ui).
> The backend it was built on (`GET /api/admin/queue/transactions`,
> `listTransactions`, `listSurpriseBonusTransactions`) is unchanged and still
> works — the walkthrough below now describes how to call it directly (e.g.
> via `curl` or a DB client) rather than steps to click through in the UI.

## Prerequisites

- Admin session with the `QUEUE_MANAGEMENT` RBAC feature (same gate as the
  rest of `/admin/queue`).
- No new env vars or migrations — this reuses `point_transaction` and
  `background_jobs` data that already exists.

## Using it end-to-end

1. Go to **Admin → Queue** (`/admin/queue`).
2. Pick a job type from the dropdown (e.g. **Surprise Bonus**).
3. Click the **Transactions** tab next to **Jobs**.
4. You get a flat table — one row per already-credited user (`state:
   completed`) plus one row per batch still pending/processing/failed. Rows
   default to hiding **Completed** (mirrors how Odoo's job queue hides
   "Done" by default) — click the **Completed** chip to bring those back, or
   toggle any of the four state chips to narrow the list further.
5. A **Pending**/**Processing**/**Failed** row is a whole batch (up to 100
   users), not a single user — its **Detail** column shows the batch's last
   error, or `"Stale — locked but not progressing"` if it's been locked past
   the 3-minute reclaim window, or an `attempts/maxAttempts` count otherwise.
   Click **Retry stuck jobs** (same button as the Jobs tab) to unstick it.
6. **Reference** is the campaign id (`surprise_bonus_campaign.id`), truncated
   — cross-reference it against **Point Transactions** in the sidebar to see
   the campaign's own progress bar.

## Extending it to another job type

The **Transactions** tab is generic — any job type can opt in:

1. Add a `listTransactions` function matching the
   `QueueJobDefinition["listTransactions"]` shape
   (`lib/queue/types.ts`):

   ```ts
   async function listMyJobTransactions(limit: number): Promise<QueueTransactionRow[]> {
     // return your finest-grained rows, newest first, already sliced to `limit`
   }
   ```

2. Pass it into your `registerQueueJob({ ... })` call, alongside `handler`
   and (optionally) `describeJobs`:

   ```ts
   registerQueueJob({
     type: MY_JOB_TYPE,
     label: "My Feature",
     handler: processMyJob,
     listTransactions: listMyJobTransactions,
   })
   ```

3. That's it — `GET /api/admin/queue/transactions?type=<MY_JOB_TYPE>` and the
   `QueueDashboard` UI both pick it up automatically. If you don't add the
   hook, the tab still shows for your type, just with a "Per-transaction
   detail isn't available for this job type yet." message instead of a
   table — nothing breaks.

See `listSurpriseBonusTransactions` in `features/points/db/surprise-bonus.ts`
for a worked example that merges two data sources (a ledger table plus the
still-in-flight `background_jobs` rows); a simpler job type with a single
per-unit table backing it can just query that one table directly.

## Common errors

| Error | Cause |
|-------|-------|
| "Per-transaction detail isn't available for this job type yet." | The selected type's `registerQueueJob` call has no `listTransactions` — expected for job types that haven't been wired up yet. |
| A batch shows `detail: "Stale — locked but not progressing"` but never resolves | Same underlying issue as a stale row on the Jobs tab — click **Retry stuck jobs**, or see [`surprise-bonus-stale-job-reclaim.md`](../technical/surprise-bonus-stale-job-reclaim.md). |
| A user's credit doesn't show up in Transactions at all | If it failed (not just pending), `grant_surprise_bonus_user` never wrote a `point_transaction` row for it — check the owning batch's `lastError`/`detail` instead of looking for a per-user row (see [`queue-transactions-view.md`](../technical/queue-transactions-view.md#why-two-data-sources-and-why-transaction-detail-is-asymmetric)). |
