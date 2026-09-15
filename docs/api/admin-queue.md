# /api/admin/queue: list/detail/transactions/retry/requeue/done/cancel/delete

> **Auto-delete on completion:** a job's `background_jobs` row is deleted
> the moment it reaches `completed` — via the normal handler-success path
> (`completeJob`) or the manual **Mark done** override (`setJobDone`), for
> every registered job type. `failed` and `cancelled` rows are unaffected
> and still require the manual **Delete** action. See "Auto-delete on
> completion" in
> [`docs/technical/queue-job-lifecycle-actions.md`](../technical/queue-job-lifecycle-actions.md)
> for what this does to `counts.completed`, `completed24h`,
> `completed24hDeltaPct`, `p95RunTimeMs`, `throughput`, and `failureRatePct`
> below — those fields are shown here with example (pre-change) values for
> context, but a completed job no longer sticks around long enough to be
> counted by most of them.

## GET /api/admin/queue

**Auth:** Admin session, or internal session with the `queue_management` RBAC permission (`requireAdminOrFeature`).

**Query params:**
- `type` (optional) — a registered job type's identifier.
- `range` (optional, only used with `type`) — `24h` | `7d` | `30d` | `all`, filters the returned jobs by `createdAt`. Defaults to `7d`.

**Response — no `type`** (powers the `/admin/queue` overview page — see
[`docs/technical/queue-console-redesign.md`](../technical/queue-console-redesign.md)):
```json
{
  "types": [{ "type": "surprise_bonus_batch", "label": "Surprise Bonus" }],
  "summaries": [
    {
      "type": "surprise_bonus_batch",
      "label": "Surprise Bonus",
      "counts": { "pending": 1, "processing": 0, "completed": 40, "failed": 0, "cancelled": 0, "stale": 0 },
      "depth": 1,
      "failed24h": 0,
      "completed24h": 12,
      "p95RunTimeMs": 3200,
      "throughput": [8, 12, 9, 14, 11, 16, 12, 18],
      "lastRunAt": "2026-09-15T09:30:00.000Z",
      "oldestPendingAgeMs": null,
      "health": "healthy"
    }
  ],
  "platform": {
    "completed24h": 12,
    "completed24hDeltaPct": 6.2,
    "failed24h": 0,
    "processed24h": 12,
    "failureRatePct": 0,
    "p95RunTimeMs": 3200,
    "throughput": [8, 12, 9, 14, 11, 16, 12, 18],
    "oldestPendingAgeMs": null,
    "oldestPendingType": null
  },
  "checkedAt": "2026-09-15T09:32:00.000Z",
  "thresholds": { "pendingAgeAlertMs": 900000, "failureRateSloPct": 1, "staleAfterMs": 180000, "maxAttempts": 5 }
}
```

`health` is one of `"healthy" | "stale" | "failing" | "idle"`, derived at
read time (see `classifyQueueHealth` in `lib/queue/queue.ts`) — never
stored. `throughput` is 8 hourly completed-job-count buckets, oldest first.

**Response — with `type`** (powers `/admin/queue/[type]`):
```json
{
  "types": [{ "type": "surprise_bonus_batch", "label": "Surprise Bonus" }],
  "selectedType": "surprise_bonus_batch",
  "label": "Surprise Bonus",
  "counts": { "pending": 1, "processing": 0, "completed": 40, "failed": 0, "cancelled": 0, "stale": 0 },
  "summary": { "...": "same shape as one entry of `summaries` above" },
  "thresholds": { "pendingAgeAlertMs": 900000, "failureRateSloPct": 1, "staleAfterMs": 180000, "maxAttempts": 5 },
  "jobs": [
    {
      "id": "job-1",
      "status": "processing",
      "isStale": true,
      "attempts": 1,
      "maxAttempts": 5,
      "availableAt": "2026-09-08T09:59:00.000Z",
      "lockedAt": "2026-09-08T10:00:00.000Z",
      "lockedBy": "local-abc123",
      "lastError": null,
      "result": null,
      "createdAt": "2026-09-08T09:58:00.000Z",
      "completedAt": null,
      "description": "Sweet December"
    }
  ]
}
```

`result` is whatever plain object the job's handler returned on success
(e.g. `{ "batchUsers": 50, "newlyGranted": 48 }`), or `null` for a job that
hasn't completed, that failed, or that predates this field. The admin panel
renders it in the row's expandable detail strip and in the job drawer's
lifecycle timeline.

**Errors:** `401` unauthorized, `403` forbidden, `404` unknown `type`.

**Example:**
```bash
curl -H "Cookie: better-auth.session_token=..." \
  "https://<host>/api/admin/queue?type=surprise_bonus_batch&range=7d"
```

**Mobile flag:** not used by the mobile app — admin-only.

## GET /api/admin/queue/[id]

**Auth:** same as `GET /api/admin/queue`.

Single-job lookup backing the job detail drawer on `/admin/queue/[type]`
(fetched client-side so the queue list underneath doesn't unmount) — the
same shape as one entry of `GET /api/admin/queue?type=...`'s `jobs` array,
plus `type`, `label`, and `payload`:

```json
{
  "id": "job-1",
  "type": "surprise_bonus_batch",
  "label": "Surprise Bonus",
  "status": "failed",
  "isStale": false,
  "attempts": 5,
  "maxAttempts": 5,
  "availableAt": "2026-09-08T09:59:00.000Z",
  "lockedAt": null,
  "lockedBy": null,
  "lastError": "grant_surprise_bonus_user: relation missing",
  "result": null,
  "payload": { "campaignId": "campaign-1" },
  "createdAt": "2026-09-08T09:58:00.000Z",
  "completedAt": "2026-09-08T10:00:00.000Z",
  "description": "Sweet December"
}
```

**Errors:** `401` unauthorized, `403` forbidden, `404` unknown job id.

**Example:**
```bash
curl -H "Cookie: better-auth.session_token=..." \
  "https://<host>/api/admin/queue/job-1"
```

**Mobile flag:** not used by the mobile app — admin-only.

## DELETE /api/admin/queue/[id]

**Auth:** same as `GET`.

Removes one job's queue-tracking row. Only permitted when the job is already
`completed` or `failed` — a pending/processing job is never deletable (it may
be actively locked by a drain pass). This only tidies up the queue view;
whatever the job produced (a campaign record, ledger entries, etc.) is
untouched. In practice a `completed` job is deleted automatically the moment
it completes (see the auto-delete note above), so this route now mostly
matters for `failed`/`cancelled` jobs.

**Response (200):**
```json
{ "success": true, "id": "job-1" }
```

**Errors:** `401` unauthorized, `403` forbidden, `404` when the job doesn't
exist or isn't `completed`/`failed` (`{ "error": "Job not found, or not
completed/failed" }`).

**Example:**
```bash
curl -X DELETE -H "Cookie: better-auth.session_token=..." \
  "https://<host>/api/admin/queue/job-1"
```

**Mobile flag:** not used by the mobile app — admin-only.

## POST /api/admin/queue/retry

**Auth:** same as `GET`.

**Body:**
```json
{ "type": "surprise_bonus_batch" }
```

**Response (200):**
```json
{ "success": true, "batches": 2 }
```

**Errors:** `400` missing `type`, `401` unauthorized, `403` forbidden, `404` unknown `type`, `500` when the drain throws (`{ "error": "Retry failed: <message>" }`).

**Example:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=..." \
  -d '{"type":"surprise_bonus_batch"}' \
  "https://<host>/api/admin/queue/retry"
```

**Mobile flag:** not used by the mobile app — admin-only.

## GET /api/admin/queue/transactions

**Auth:** same as `GET /api/admin/queue`.

Flat, per-unit-of-work rows for a job type — the finest granularity that
type's registration can report, via its optional `listTransactions` hook
(see
[`docs/technical/queue-transactions-view.md`](../technical/queue-transactions-view.md)
and [`docs/guides/queue-transactions.md`](../guides/queue-transactions.md)).
Not called from `/admin/queue`'s UI anymore — the Transactions tab was
removed (see
[`docs/technical/queue-console-redesign.md`](../technical/queue-console-redesign.md#transactions-tab-removed-from-ui))
— but the route and its underlying hook are unchanged and still callable
directly.

**Query params:**
- `type` (required) — a registered job type's identifier.
- `limit` (optional) — max rows to return; defaults to `200`, clamped to `500`.

**Response — job type with a `listTransactions` hook:**
```json
{
  "supported": true,
  "transactions": [
    {
      "id": "job-1",
      "source": "job",
      "description": "Credit batch — NYC200",
      "state": "pending",
      "createdAt": "2026-09-14T21:02:00.000Z",
      "completedAt": null,
      "reference": "campaign-1",
      "detail": "0/5 attempts"
    },
    {
      "id": "tx-1",
      "source": "transaction",
      "description": "Jane Doe (jane@example.com)",
      "state": "completed",
      "createdAt": "2026-09-14T09:00:00.000Z",
      "completedAt": "2026-09-14T09:00:00.000Z",
      "reference": "campaign-1",
      "detail": "+500 pts"
    }
  ]
}
```

`source` is `"job"` for a still-in-flight `background_jobs` batch row, or
`"transaction"` for an individual, already-completed ledger row — only
`"job"`-sourced rows correspond to a deletable id via `DELETE
/api/admin/queue/[id]`.

**Response — job type with no `listTransactions` hook (still `200`):**
```json
{ "supported": false, "transactions": [] }
```

**Errors:** `400` missing `type`, `401` unauthorized, `403` forbidden, `404` unknown `type`.

**Example:**
```bash
curl -H "Cookie: better-auth.session_token=..." \
  "https://<host>/api/admin/queue/transactions?type=surprise_bonus_batch&limit=100"
```

**Mobile flag:** not used by the mobile app — admin-only.

## POST /api/admin/queue/[id]/requeue

**Auth:** same as `GET /api/admin/queue`.

Per-job manual override: resets one job to `pending` for reprocessing on the
next drain pass. Allowed from any status, including `completed`, **except**
`processing` with a still-fresh lock — see
[`docs/technical/queue-job-lifecycle-actions.md`](../technical/queue-job-lifecycle-actions.md)
for why (a live worker may genuinely still be executing it). Powers the
**Retry now** button in the job drawer / on `/admin/queue/jobs/[id]`.

**Response (200):**
```json
{ "success": true, "id": "job-1" }
```

**Errors:** `401` unauthorized, `403` forbidden, `404` unknown job id, or job is `processing` with a lock that hasn't gone stale yet (`{ "error": "Job not found, or still actively processing" }`).

**Example:**
```bash
curl -X POST -H "Cookie: better-auth.session_token=..." \
  "https://<host>/api/admin/queue/job-1/requeue"
```

**Mobile flag:** not used by the mobile app — admin-only.

## POST /api/admin/queue/[id]/done

**Auth:** same as `GET /api/admin/queue`.

Per-job manual override: force-completes one job without running its
handler, then deletes its tracking row — same as the normal completion path
(and the same as `DELETE /api/admin/queue/[id]`), so no record of who forced
it or when is kept. Powers the **Mark done** button.

**Response (200):**
```json
{ "success": true, "id": "job-1" }
```

**Errors:** `401` unauthorized, `403` forbidden, `404` unknown job id.

**Example:**
```bash
curl -X POST -H "Cookie: better-auth.session_token=..." \
  "https://<host>/api/admin/queue/job-1/done"
```

**Mobile flag:** not used by the mobile app — admin-only.

## POST /api/admin/queue/[id]/cancel

**Auth:** same as `GET /api/admin/queue`.

Per-job manual override: marks one job `cancelled` (terminal — excluded from
pending/processing counts and from the retry drain), with `lastError` set to
`"Cancelled by admin (<adminId>)"`. Blocked on an already-`completed` job.
Powers the **Cancel job** button.

**Response (200):**
```json
{ "success": true, "id": "job-1" }
```

**Errors:** `401` unauthorized, `403` forbidden, `404` unknown job id, or job already `completed` (`{ "error": "Job not found, or already completed" }`).

**Example:**
```bash
curl -X POST -H "Cookie: better-auth.session_token=..." \
  "https://<host>/api/admin/queue/job-1/cancel"
```

**Mobile flag:** not used by the mobile app — admin-only.
