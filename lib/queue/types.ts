export type QueueJobPayload = Record<string, unknown>

// Deliberately NOT generic over payload type: a generic ClaimedQueueJob<TPayload>
// makes QueueJobHandler<TPayload> contravariant in TPayload, so a feature's
// handler (typed to its own payload shape) fails to type-check when assigned
// into QueueJobDefinition.handler (typed as the base QueueJobHandler) — the
// target would need TPayload assignable FROM the base QueueJobPayload, which
// a narrower payload type never satisfies. Every payload is JSONB underneath
// anyway (no runtime enforcement), so handlers cast job.payload to their own
// shape internally instead — see processSurpriseBonusJob in Task 6.
export type ClaimedQueueJob = {
  id: string
  type: string
  payload: QueueJobPayload
  attempts: number
  maxAttempts: number
}

/** Structured outcome a handler may return on success — recorded on the job row for admin-panel display (see QueueJobRow.result). */
export type QueueJobResult = Record<string, unknown>

export type QueueJobHandler = (job: ClaimedQueueJob) => Promise<QueueJobResult | void>

export type QueueJobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled"

export type QueueJobRow = {
  id: string
  type: string
  payload: QueueJobPayload
  status: QueueJobStatus
  attempts: number
  maxAttempts: number
  availableAt: Date
  lockedAt: Date | null
  lockedBy: string | null
  lastError: string | null
  result: QueueJobResult | null
  createdAt: Date
  completedAt: Date | null
  isStale: boolean
}

export type QueueJobStatusCounts = {
  pending: number
  processing: number
  completed: number
  failed: number
  cancelled: number
  stale: number
}

/** Overview-screen health classification for one queue type — derived from live counts, never stored. */
export type QueueHealth = "healthy" | "stale" | "failing" | "idle"

/**
 * Aggregate metrics for one queue type's row on the /admin/queue overview
 * table — everything here is computed from background_jobs at read time
 * (see getQueueTypeSummary), not cached or persisted.
 */
export type QueueTypeSummary = {
  type: string
  label: string
  counts: QueueJobStatusCounts
  /** pending + processing */
  depth: number
  failed24h: number
  completed24h: number
  /** p95 run time (completedAt - createdAt) over jobs completed in the last 24h, in ms. Null when no completions in the window. */
  p95RunTimeMs: number | null
  /** Hourly completed-job counts for the last 8 hours, oldest first. */
  throughput: number[]
  lastRunAt: string | null
  /** Age of the oldest still-pending job, in ms. Null when nothing is pending. */
  oldestPendingAgeMs: number | null
  health: QueueHealth
}

/**
 * One row in the flat, Odoo-style "Transactions" view of /admin/queue — the
 * finest-grained unit of work a job type can report. For Surprise Bonus this
 * mixes two sources: one row per already-credited user (sourced from
 * point_transaction, always `state: "completed"`) and one row per
 * still-in-flight batch (sourced from background_jobs, `state` mirrors the
 * job's own pending/processing/failed status) — see
 * listSurpriseBonusTransactions. `source` tells the client which id space
 * `id` belongs to, since only job-sourced rows can be deleted via the
 * existing DELETE /api/admin/queue/[id].
 */
export type QueueTransactionRow = {
  id: string
  source: "transaction" | "job"
  description: string
  state: QueueJobStatus
  createdAt: Date
  completedAt: Date | null
  reference: string | null
  detail: string | null
}

export type QueueJobDefinition = {
  type: string
  label: string
  handler: QueueJobHandler
  /** Batch-enrich rows for the admin panel (e.g. join a campaign name). Called once per page load, not per row. */
  describeJobs?: (jobs: QueueJobRow[]) => Promise<Map<string, string>>
  /** Per-unit-of-work rows for the flat "Transactions" view. Omit if this job type has no finer-than-batch granularity to show. */
  listTransactions?: (limit: number) => Promise<QueueTransactionRow[]>
}
