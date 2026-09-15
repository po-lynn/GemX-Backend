import { and, desc, eq, gt, inArray, lt, ne, or, sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { backgroundJobs } from "@/drizzle/schema/queue-schema"
import type {
  ClaimedQueueJob,
  QueueHealth,
  QueueJobPayload,
  QueueJobRow,
  QueueJobStatusCounts,
  QueueTypeSummary,
} from "@/lib/queue/types"

/** Matches the reclaim window baked into claim_background_job (migration 0087). */
export const STALE_AFTER_MS = 3 * 60 * 1000

export const DEFAULT_MAX_ATTEMPTS = 5

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

/**
 * A completed job's tracking row is deleted immediately rather than kept
 * around with `status: "completed"` — whatever the job produced (a ledger
 * entry, a campaign update, etc.) already persisted elsewhere before the
 * handler returned, so the queue row itself has no further use. See
 * "Auto-delete on completion" in docs/technical/queue-job-lifecycle-actions.md
 * for what this does to the dashboard's completed/24h, p95, and throughput
 * metrics.
 */
export async function completeJob(jobId: string): Promise<void> {
  await db.delete(backgroundJobs).where(eq(backgroundJobs.id, jobId))
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

export async function listJobs(type: string, limit = 100, opts?: { since?: Date }): Promise<QueueJobRow[]> {
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
    .where(
      opts?.since
        ? and(eq(backgroundJobs.type, type), gt(backgroundJobs.createdAt, opts.since))
        : eq(backgroundJobs.type, type),
    )
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
 * (`completed`, `failed`, or `cancelled`). A pending/processing job is never deletable
 * (it may be actively locked by a drain pass), so the status check happens
 * inside the same query as the delete rather than as a separate read, to
 * avoid a race between checking and deleting. This only removes the queue
 * row itself; whatever the job produced (a campaign record, ledger entries,
 * etc.) is untouched.
 */
export async function deleteJob(id: string): Promise<boolean> {
  const deleted = await db
    .delete(backgroundJobs)
    .where(and(eq(backgroundJobs.id, id), inArray(backgroundJobs.status, ["completed", "failed", "cancelled"])))
    .returning({ id: backgroundJobs.id })
  return deleted.length > 0
}

/** Single job lookup for the /admin/queue/jobs/[id] detail page (and the job drawer's GET /api/admin/queue/[id]). */
export async function getJob(id: string): Promise<QueueJobRow | null> {
  const [row] = await db
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
    .where(eq(backgroundJobs.id, id))
    .limit(1)
  if (!row) return null

  const status = row.status as QueueJobRow["status"]
  return {
    ...row,
    status,
    isStale: status === "processing" && row.lockedAt !== null && Date.now() - row.lockedAt.getTime() > STALE_AFTER_MS,
  }
}

/**
 * Manual admin override: forces a job back to `pending` for reprocessing on
 * the next drain pass — mirrors Odoo queue_job's always-available "Requeue
 * Job" button, and is allowed from any status (including
 * completed/failed/cancelled) EXCEPT `processing` with a still-fresh lock.
 * That one exclusion matters: `pending` is the one status
 * `claim_background_job` looks for, so requeuing a job a live drain pass is
 * still genuinely executing would let a second worker claim and run the
 * same batch concurrently. grant_surprise_bonus_user's per-(user, campaign)
 * uniqueness prevents double-crediting, but the two workers' plain
 * read-modify-write updates to surpriseBonusCampaign's progress counters
 * (features/points/services/process-surprise-bonus-jobs.ts) are not
 * similarly protected, so a real race there would still corrupt those
 * counts. Once the lock goes stale (same STALE_AFTER_MS window
 * claim_background_job's own reclaim uses), the original worker is
 * presumed dead and requeuing is safe again.
 */
export async function requeueJob(id: string): Promise<boolean> {
  const staleCutoff = new Date(Date.now() - STALE_AFTER_MS)
  const [row] = await db
    .update(backgroundJobs)
    .set({ status: "pending", availableAt: new Date(), lockedAt: null, lockedBy: null, lastError: null })
    .where(
      and(
        eq(backgroundJobs.id, id),
        or(ne(backgroundJobs.status, "processing"), lt(backgroundJobs.lockedAt, staleCutoff)),
      ),
    )
    .returning({ id: backgroundJobs.id })
  return !!row
}

/**
 * Manual admin override: force-completes a job without running its handler
 * — for a job an admin has verified is effectively done by other means.
 * Allowed from any status. Like the normal completion path (completeJob),
 * this deletes the row rather than setting status: "completed", so no
 * record of who forced it or when is kept — the same trade-off `deleteJob`
 * already makes for a manual delete.
 */
export async function setJobDone(id: string): Promise<boolean> {
  const [row] = await db.delete(backgroundJobs).where(eq(backgroundJobs.id, id)).returning({ id: backgroundJobs.id })
  return !!row
}

/**
 * Manual admin override: marks a job `cancelled` (terminal, excluded from
 * pending/processing counts and from the retry drain) so it stops being
 * attempted. Blocked on an already-`completed` job — cancelling finished
 * work makes no sense — but otherwise allowed from any status, same as
 * requeue/setJobDone.
 */
export async function cancelJob(id: string, reason: string): Promise<boolean> {
  const [row] = await db
    .update(backgroundJobs)
    .set({ status: "cancelled", completedAt: new Date(), lockedAt: null, lockedBy: null, lastError: reason })
    .where(and(eq(backgroundJobs.id, id), ne(backgroundJobs.status, "completed")))
    .returning({ id: backgroundJobs.id })
  return !!row
}

/** Rolling-1h failure-rate alert threshold shown on the overview page and used to classify a queue as "failing". */
export const FAILURE_RATE_SLO_PCT = 1.0

/** Age past which a still-pending, already-available job is flagged as an alert on the overview page. */
export const PENDING_AGE_ALERT_MS = 15 * 60 * 1000

function classifyQueueHealth(counts: QueueJobStatusCounts, failed24h: number, completed24h: number): QueueHealth {
  if (failed24h > 0) return "failing"
  if (counts.stale > 0) return "stale"
  if (completed24h === 0 && counts.pending === 0 && counts.processing === 0) return "idle"
  return "healthy"
}

type QueueSummaryRawRow = {
  pending: number
  processing: number
  completed: number
  failed: number
  cancelled: number
  stale: number
  failed_24h: number
  completed_24h: number
  p95_seconds: number | string | null
  last_completed_at: Date | string | null
  last_created_at: Date | string | null
  oldest_pending_available_at: Date | string | null
}

/** Zero-filled hourly buckets for the last 8 hours (oldest first) — used for both per-type and platform-wide throughput sparklines. */
async function hourlyThroughputBuckets(typeFilter: ReturnType<typeof sql>): Promise<number[]> {
  const rows = normalizeRows<{ bucket: Date | string; n: number }>(
    await db.execute(sql`
      select gs.bucket, coalesce(count(bj.id), 0)::int as n
      from generate_series(
        date_trunc('hour', now()) - interval '7 hours',
        date_trunc('hour', now()),
        interval '1 hour'
      ) as gs(bucket)
      left join background_jobs bj
        on bj.status = 'completed'
        and date_trunc('hour', bj.completed_at) = gs.bucket
        and ${typeFilter}
      group by gs.bucket
      order by gs.bucket
    `),
  )
  return rows.map((r) => r.n)
}

function toIsoOrNull(v: Date | string | null): string | null {
  return v ? new Date(v).toISOString() : null
}

/**
 * Aggregate metrics for one queue type's row on the /admin/queue overview
 * table. Everything is computed from background_jobs at read time — see
 * QueueTypeSummary for field meanings.
 */
export async function getQueueTypeSummary(type: string, label: string): Promise<QueueTypeSummary> {
  const [row] = normalizeRows<QueueSummaryRawRow>(
    await db.execute(sql`
      select
        count(*) filter (where status = 'pending')::int as pending,
        count(*) filter (where status = 'processing')::int as processing,
        count(*) filter (where status = 'completed')::int as completed,
        count(*) filter (where status = 'failed')::int as failed,
        count(*) filter (where status = 'cancelled')::int as cancelled,
        count(*) filter (
          where status = 'processing' and locked_at < now() - (${STALE_AFTER_MS} * interval '1 millisecond')
        )::int as stale,
        count(*) filter (where status = 'failed' and completed_at > now() - interval '24 hours')::int as failed_24h,
        count(*) filter (where status = 'completed' and completed_at > now() - interval '24 hours')::int as completed_24h,
        percentile_cont(0.95) within group (order by extract(epoch from (completed_at - created_at)))
          filter (where status = 'completed' and completed_at > now() - interval '24 hours') as p95_seconds,
        max(completed_at) as last_completed_at,
        max(created_at) as last_created_at,
        min(available_at) filter (where status = 'pending' and available_at <= now()) as oldest_pending_available_at
      from background_jobs
      where type = ${type}
    `),
  )

  const counts: QueueJobStatusCounts = {
    pending: row?.pending ?? 0,
    processing: row?.processing ?? 0,
    completed: row?.completed ?? 0,
    failed: row?.failed ?? 0,
    cancelled: row?.cancelled ?? 0,
    stale: row?.stale ?? 0,
  }
  const failed24h = row?.failed_24h ?? 0
  const completed24h = row?.completed_24h ?? 0
  const p95Seconds = row?.p95_seconds != null ? Number(row.p95_seconds) : null
  const oldestPendingAvailableAt = row?.oldest_pending_available_at ?? null

  return {
    type,
    label,
    counts,
    depth: counts.pending + counts.processing,
    failed24h,
    completed24h,
    p95RunTimeMs: p95Seconds != null ? Math.round(p95Seconds * 1000) : null,
    throughput: await hourlyThroughputBuckets(sql`bj.type = ${type}`),
    lastRunAt: toIsoOrNull(row?.last_completed_at ?? row?.last_created_at ?? null),
    oldestPendingAgeMs: oldestPendingAvailableAt
      ? Math.max(0, Date.now() - new Date(oldestPendingAvailableAt).getTime())
      : null,
    health: classifyQueueHealth(counts, failed24h, completed24h),
  }
}

export type PlatformQueueSummary = {
  completed24h: number
  /** % change vs the preceding 24h window; null when the preceding window had zero completions (division undefined). */
  completed24hDeltaPct: number | null
  failed24h: number
  /** completed24h + failed24h — the denominator behind the failure-rate card ("of N"). */
  processed24h: number
  failureRatePct: number
  p95RunTimeMs: number | null
  throughput: number[]
  oldestPendingAgeMs: number | null
  oldestPendingType: string | null
}

/** Platform-wide KPIs for the overview page's top row, scoped to the given (registered) types only. */
export async function getPlatformQueueSummary(types: string[]): Promise<PlatformQueueSummary> {
  if (types.length === 0) {
    return {
      completed24h: 0,
      completed24hDeltaPct: null,
      failed24h: 0,
      processed24h: 0,
      failureRatePct: 0,
      p95RunTimeMs: null,
      throughput: [0, 0, 0, 0, 0, 0, 0, 0],
      oldestPendingAgeMs: null,
      oldestPendingType: null,
    }
  }

  const [row] = normalizeRows<{
    completed_24h: number
    completed_prev_24h: number
    failed_24h: number
    p95_seconds: number | string | null
  }>(
    await db.execute(sql`
      select
        count(*) filter (where status = 'completed' and completed_at > now() - interval '24 hours')::int as completed_24h,
        count(*) filter (
          where status = 'completed' and completed_at <= now() - interval '24 hours' and completed_at > now() - interval '48 hours'
        )::int as completed_prev_24h,
        count(*) filter (where status = 'failed' and completed_at > now() - interval '24 hours')::int as failed_24h,
        percentile_cont(0.95) within group (order by extract(epoch from (completed_at - created_at)))
          filter (where status = 'completed' and completed_at > now() - interval '24 hours') as p95_seconds
      from background_jobs
      where type in ${types}
    `),
  )

  const [oldest] = normalizeRows<{ type: string; available_at: Date | string }>(
    await db.execute(sql`
      select type, available_at
      from background_jobs
      where status = 'pending' and available_at <= now() and type in ${types}
      order by available_at asc
      limit 1
    `),
  )

  const completed24h = row?.completed_24h ?? 0
  const completedPrev24h = row?.completed_prev_24h ?? 0
  const failed24h = row?.failed_24h ?? 0
  const processed24h = completed24h + failed24h
  const p95Seconds = row?.p95_seconds != null ? Number(row.p95_seconds) : null

  return {
    completed24h,
    completed24hDeltaPct: completedPrev24h > 0 ? ((completed24h - completedPrev24h) / completedPrev24h) * 100 : null,
    failed24h,
    processed24h,
    failureRatePct: processed24h > 0 ? (failed24h / processed24h) * 100 : 0,
    p95RunTimeMs: p95Seconds != null ? Math.round(p95Seconds * 1000) : null,
    throughput: await hourlyThroughputBuckets(sql`bj.type in ${types}`),
    oldestPendingAgeMs: oldest ? Math.max(0, Date.now() - new Date(oldest.available_at).getTime()) : null,
    oldestPendingType: oldest?.type ?? null,
  }
}
