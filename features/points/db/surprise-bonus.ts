import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { pointTransaction } from "@/drizzle/schema/points-schema"
import { backgroundJobs } from "@/drizzle/schema/queue-schema"
import {
  surpriseBonusCampaign,
  SURPRISE_BONUS_JOB_TYPE,
  SURPRISE_BONUS_PUSH_JOB_TYPE,
} from "@/drizzle/schema/surprise-bonus-schema"
import { STALE_AFTER_MS } from "@/lib/queue/queue"
import type { QueueJobRow, QueueTransactionRow } from "@/lib/queue/types"
import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm"

export type SurpriseBonusCampaignRow = typeof surpriseBonusCampaign.$inferSelect

export type SurpriseBonusCampaignProgress = {
  id: string
  name: string
  pointsPerUser: number
  recipientType: string
  note: string | null
  totalUsers: number
  processedUsers: number
  successCount: number
  failedCount: number
  status: string
  createdBy: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export async function countActiveUsers(): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(user)
    .where(and(eq(user.banned, false), eq(user.archived, false)))
  return row?.value ?? 0
}

export async function createSurpriseBonusCampaign(input: {
  name: string
  pointsPerUser: number
  note?: string | null
  totalUsers: number
  createdBy: string
}): Promise<SurpriseBonusCampaignRow> {
  const [row] = await db
    .insert(surpriseBonusCampaign)
    .values({
      name: input.name,
      pointsPerUser: input.pointsPerUser,
      recipientType: "all_users",
      note: input.note?.trim() || null,
      totalUsers: input.totalUsers,
      processedUsers: 0,
      successCount: 0,
      failedCount: 0,
      status: "pending",
      createdBy: input.createdBy,
    })
    .returning()
  return row
}

export async function markSurpriseBonusCampaignProcessing(campaignId: string): Promise<void> {
  await db
    .update(surpriseBonusCampaign)
    .set({ status: "processing", startedAt: new Date(), updatedAt: new Date() })
    .where(eq(surpriseBonusCampaign.id, campaignId))
}

export async function getSurpriseBonusCampaignById(
  campaignId: string,
): Promise<SurpriseBonusCampaignProgress | null> {
  const [row] = await db
    .select()
    .from(surpriseBonusCampaign)
    .where(eq(surpriseBonusCampaign.id, campaignId))
    .limit(1)
  return row ?? null
}

/**
 * Batch-enrich queue admin rows with their campaign name (one query for the
 * whole page, not per row) — the describeJobs hook for the surprise_bonus_batch
 * queue job type.
 */
export async function describeSurpriseBonusJobs(jobs: QueueJobRow[]): Promise<Map<string, string>> {
  const campaignIds = [
    ...new Set(
      jobs
        .map((j) => (j.payload as { campaignId?: string }).campaignId)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  if (campaignIds.length === 0) return new Map()

  const campaigns = await db
    .select({ id: surpriseBonusCampaign.id, name: surpriseBonusCampaign.name })
    .from(surpriseBonusCampaign)
    .where(inArray(surpriseBonusCampaign.id, campaignIds))

  const nameById = new Map(campaigns.map((c) => [c.id, c.name]))
  const result = new Map<string, string>()
  for (const job of jobs) {
    const campaignId = (job.payload as { campaignId?: string }).campaignId
    if (campaignId && nameById.has(campaignId)) {
      result.set(job.id, nameById.get(campaignId)!)
    }
  }
  return result
}

/**
 * The listTransactions hook for SURPRISE_BONUS_JOB_TYPE — the flat,
 * per-unit-of-work rows behind /admin/queue's "Transactions" view. Merges two
 * sources because a credited user is only ever recorded once the RPC commits:
 *  - one row per already-credited user, read straight off point_transaction
 *    (always `state: "completed"` — grant_surprise_bonus_user never leaves a
 *    row behind for a failed grant, see scripts/surprise-bonus-rpcs.sql, so
 *    per-user failures aren't representable here yet)
 *  - one row per still-in-flight credit/push batch, read off background_jobs,
 *    for whichever users that batch hasn't resolved into a transaction yet
 */
export async function listSurpriseBonusTransactions(limit: number): Promise<QueueTransactionRow[]> {
  const [transactionRows, jobRows] = await Promise.all([
    db
      .select({
        id: pointTransaction.id,
        amount: pointTransaction.amount,
        referenceId: pointTransaction.referenceId,
        createdAt: pointTransaction.createdAt,
        userName: user.name,
        userEmail: user.email,
      })
      .from(pointTransaction)
      .innerJoin(user, eq(pointTransaction.userId, user.id))
      .where(eq(pointTransaction.referenceType, "surprise_bonus_campaign"))
      .orderBy(desc(pointTransaction.createdAt))
      .limit(limit),
    db
      .select({
        id: backgroundJobs.id,
        type: backgroundJobs.type,
        payload: backgroundJobs.payload,
        status: backgroundJobs.status,
        attempts: backgroundJobs.attempts,
        maxAttempts: backgroundJobs.maxAttempts,
        lockedAt: backgroundJobs.lockedAt,
        lastError: backgroundJobs.lastError,
        createdAt: backgroundJobs.createdAt,
        completedAt: backgroundJobs.completedAt,
      })
      .from(backgroundJobs)
      .where(
        and(
          or(eq(backgroundJobs.type, SURPRISE_BONUS_JOB_TYPE), eq(backgroundJobs.type, SURPRISE_BONUS_PUSH_JOB_TYPE)),
          // completeJob (lib/queue/queue.ts) now deletes a job's row on completion, so this
          // never actually excludes anything anymore — left in as defensive/self-documenting
          // intent (a "completed" job shouldn't double up with its own transaction row) in
          // case that changes.
          ne(backgroundJobs.status, "completed"),
        ),
      )
      .orderBy(desc(backgroundJobs.createdAt))
      .limit(limit),
  ])

  const jobCampaignIds = [
    ...new Set(
      jobRows
        .map((j) => (j.payload as { campaignId?: string }).campaignId)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const campaigns =
    jobCampaignIds.length > 0
      ? await db
          .select({ id: surpriseBonusCampaign.id, name: surpriseBonusCampaign.name })
          .from(surpriseBonusCampaign)
          .where(inArray(surpriseBonusCampaign.id, jobCampaignIds))
      : []
  const campaignNameById = new Map(campaigns.map((c) => [c.id, c.name]))

  const transactionEntries: QueueTransactionRow[] = transactionRows.map((t) => ({
    id: t.id,
    source: "transaction",
    description: `${t.userName} (${t.userEmail})`,
    state: "completed",
    createdAt: t.createdAt,
    completedAt: t.createdAt,
    reference: t.referenceId,
    detail: `+${t.amount} pts`,
  }))

  const now = Date.now()
  const jobEntries: QueueTransactionRow[] = jobRows.map((j) => {
    const payload = j.payload as { campaignId?: string; userIds?: string[] }
    const campaignName = payload.campaignId ? campaignNameById.get(payload.campaignId) : undefined
    const kind = j.type === SURPRISE_BONUS_PUSH_JOB_TYPE ? "Push batch" : "Credit batch"
    const batchSize = payload.userIds?.length
    const isStale = j.status === "processing" && j.lockedAt !== null && now - j.lockedAt.getTime() > STALE_AFTER_MS

    return {
      id: j.id,
      source: "job",
      description: campaignName
        ? `${kind} — ${campaignName}${batchSize ? ` (${batchSize} users)` : ""}`
        : `${kind} ${j.id.slice(0, 8)}`,
      state: j.status as QueueTransactionRow["state"],
      createdAt: j.createdAt,
      completedAt: j.completedAt,
      reference: payload.campaignId ?? null,
      detail: j.lastError ?? (isStale ? "Stale — locked but not progressing" : `${j.attempts}/${j.maxAttempts} attempts`),
    }
  })

  return [...transactionEntries, ...jobEntries]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
}
