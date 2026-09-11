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
  stale: number
}

export type QueueJobDefinition = {
  type: string
  label: string
  handler: QueueJobHandler
  /** Batch-enrich rows for the admin panel (e.g. join a campaign name). Called once per page load, not per row. */
  describeJobs?: (jobs: QueueJobRow[]) => Promise<Map<string, string>>
}
