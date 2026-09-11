import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { backgroundJobs } from "@/drizzle/schema/queue-schema"
import type { ClaimedQueueJob, QueueJobPayload, QueueJobResult, QueueJobRow, QueueJobStatusCounts } from "@/lib/queue/types"

/** Matches the reclaim window baked into claim_background_job (migration 0087). */
export const STALE_AFTER_MS = 3 * 60 * 1000

const DEFAULT_MAX_ATTEMPTS = 5

/** Normalizes drizzle/postgres-js raw execute() results (array, RowList, or { rows }). */
export function normalizeRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && Array.isArray((result as { rows: unknown }).rows)) {
    return (result as { rows: T[] }).rows
  }
  if (result && typeof result === "object" && Symbol.iterator in (result as object)) {
    return [...(result as Iterable<T>)]
  }
  return []
}

export async function enqueueJob(
  type: string,
  payload: QueueJobPayload,
  opts?: { maxAttempts?: number; availableAt?: Date },
): Promise<{ id: string }> {
  const [row] = await db
    .insert(backgroundJobs)
    .values({
      type,
      payload,
      status: "pending",
      attempts: 0,
      maxAttempts: opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      availableAt: opts?.availableAt ?? new Date(),
    })
    .returning({ id: backgroundJobs.id })
  return row
}

type ClaimedJobRawRow = {
  id: string
  type: string
  payload: QueueJobPayload | string
  attempts: number
  max_attempts: number
}

/** Claims one due/stale job of `type` via claim_background_job (FOR UPDATE SKIP LOCKED, with stale-lock reclaim). */
export async function claimJob(type: string, lockedBy: string): Promise<ClaimedQueueJob | null> {
  const rows = normalizeRows<ClaimedJobRawRow>(
    await db.execute(sql`SELECT * FROM claim_background_job(${type}, ${lockedBy})`),
  )
  const job = rows[0]
  if (!job?.id) return null

  const payload = typeof job.payload === "string" ? (JSON.parse(job.payload) as QueueJobPayload) : job.payload

  return {
    id: job.id,
    type: job.type,
    payload,
    attempts: job.attempts,
    maxAttempts: job.max_attempts,
  }
}

export async function completeJob(jobId: string, result?: QueueJobResult): Promise<void> {
  await db
    .update(backgroundJobs)
    .set({
      status: "completed",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      result: result ?? null,
    })
    .where(eq(backgroundJobs.id, jobId))
}

export async function failOrRetryJob(
  job: ClaimedQueueJob,
  error: string,
  opts?: { backoffMinutes?: (attempts: number) => number },
): Promise<void> {
  const backoffMinutes = opts?.backoffMinutes ?? ((attempts: number) => Math.min(attempts * 2, 30))

  if (job.attempts >= job.maxAttempts) {
    await db
      .update(backgroundJobs)
      .set({
        status: "failed",
        lastError: error,
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      })
      .where(eq(backgroundJobs.id, job.id))
    return
  }

  await db
    .update(backgroundJobs)
    .set({
      status: "pending",
      lastError: error,
      availableAt: new Date(Date.now() + backoffMinutes(job.attempts) * 60_000),
      lockedAt: null,
      lockedBy: null,
    })
    .where(eq(backgroundJobs.id, job.id))
}

export async function listJobs(type: string, limit = 100): Promise<QueueJobRow[]> {
  const rows = await db
    .select({
      id: backgroundJobs.id,
      type: backgroundJobs.type,
      payload: backgroundJobs.payload,
      status: backgroundJobs.status,
      attempts: backgroundJobs.attempts,
      maxAttempts: backgroundJobs.maxAttempts,
      availableAt: backgroundJobs.availableAt,
      lockedAt: backgroundJobs.lockedAt,
      lockedBy: backgroundJobs.lockedBy,
      lastError: backgroundJobs.lastError,
      result: backgroundJobs.result,
      createdAt: backgroundJobs.createdAt,
      completedAt: backgroundJobs.completedAt,
    })
    .from(backgroundJobs)
    .where(eq(backgroundJobs.type, type))
    .orderBy(desc(backgroundJobs.createdAt))
    .limit(limit)

  const now = Date.now()
  return rows.map((r) => ({
    ...r,
    status: r.status as QueueJobRow["status"],
    isStale: r.status === "processing" && r.lockedAt !== null && now - r.lockedAt.getTime() > STALE_AFTER_MS,
  }))
}

/**
 * Deletes one job's tracking row — only if it's in a terminal state
 * (`completed` or `failed`). A pending/processing job is never deletable
 * (it may be actively locked by a drain pass), so the status check happens
 * inside the same query as the delete rather than as a separate read, to
 * avoid a race between checking and deleting. This only removes the queue
 * row itself; whatever the job produced (a campaign record, ledger entries,
 * etc.) is untouched.
 */
export async function deleteJob(id: string): Promise<boolean> {
  const deleted = await db
    .delete(backgroundJobs)
    .where(and(eq(backgroundJobs.id, id), inArray(backgroundJobs.status, ["completed", "failed"])))
    .returning({ id: backgroundJobs.id })
  return deleted.length > 0
}

export async function getJobStatusCounts(type: string): Promise<QueueJobStatusCounts> {
  const [row] = await db
    .select({
      pending: sql<number>`count(*) filter (where status = 'pending')::int`,
      processing: sql<number>`count(*) filter (where status = 'processing')::int`,
      completed: sql<number>`count(*) filter (where status = 'completed')::int`,
      failed: sql<number>`count(*) filter (where status = 'failed')::int`,
      stale: sql<number>`count(*) filter (
        where status = 'processing' and locked_at < now() - (${STALE_AFTER_MS} * interval '1 millisecond')
      )::int`,
    })
    .from(backgroundJobs)
    .where(eq(backgroundJobs.type, type))
  return row ?? { pending: 0, processing: 0, completed: 0, failed: 0, stale: 0 }
}
