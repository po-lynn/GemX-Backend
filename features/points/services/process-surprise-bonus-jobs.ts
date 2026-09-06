import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import {
  backgroundJobs,
  surpriseBonusCampaign,
  SURPRISE_BONUS_JOB_TYPE,
} from "@/drizzle/schema/surprise-bonus-schema"
import { sendSurpriseBonusPushToUsers } from "@/features/points/services/surprise-bonus-push"
import { and, asc, eq, gt, sql } from "drizzle-orm"

const BATCH_SIZE = 100

type ClaimedJob = {
  id: string
  type: string
  payload: { campaignId?: string; lastUserId?: string | null }
  status: string
  attempts: number
  max_attempts: number
}

type GrantResult = { granted?: boolean; reason?: string; points?: number }

export type ProcessBatchResult =
  | { claimed: false }
  | {
      claimed: true
      jobId: string
      campaignId: string
      batchSize: number
      successDelta: number
      failedDelta: number
      hasMore: boolean
      campaignStatus: "processing" | "completed"
      pushSentTo?: number
    }

/** Normalize drizzle/postgres-js execute results (array, RowList, or { rows }). */
function asRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && Array.isArray((result as { rows: unknown }).rows)) {
    return (result as { rows: T[] }).rows
  }
  if (result && typeof result === "object" && Symbol.iterator in (result as object)) {
    return [...(result as Iterable<T>)]
  }
  return []
}

/**
 * Claim one pending surprise_bonus_batch job and credit up to BATCH_SIZE users.
 * Mirrors supabase/functions/process-background-jobs (Node/Drizzle path for local/dev).
 */
export async function processOneSurpriseBonusBatch(
  lockedBy = `local-${crypto.randomUUID().slice(0, 8)}`,
): Promise<ProcessBatchResult> {
  const claimedRows = asRows<ClaimedJob>(
    await db.execute(sql`
      SELECT * FROM claim_background_job(${SURPRISE_BONUS_JOB_TYPE}, ${lockedBy})
    `),
  )

  const job = claimedRows[0]
  if (!job?.id) return { claimed: false }

  const payload =
    typeof job.payload === "string"
      ? (JSON.parse(job.payload) as ClaimedJob["payload"])
      : job.payload

  const campaignId = payload?.campaignId
  if (!campaignId) {
    await failOrRetryJob(job, "Missing campaignId in payload")
    throw new Error("Missing campaignId in payload")
  }

  try {
    const lastUserId = payload?.lastUserId ?? null

    const conditions = [eq(user.banned, false), eq(user.archived, false)]
    if (lastUserId) conditions.push(gt(user.id, lastUserId))

    const batch = await db
      .select({ id: user.id })
      .from(user)
      .where(and(...conditions))
      .orderBy(asc(user.id))
      .limit(BATCH_SIZE)

    let successDelta = 0
    let failedDelta = 0
    const newlyGrantedUserIds: string[] = []

    for (const u of batch) {
      const grantRows = asRows<{ result: GrantResult | string }>(
        await db.execute(sql`
          SELECT grant_surprise_bonus_user(${campaignId}, ${u.id}) AS result
        `),
      )

      let result: GrantResult | string | undefined = grantRows[0]?.result
      if (typeof result === "string") {
        try {
          result = JSON.parse(result) as GrantResult
        } catch {
          result = undefined
        }
      }

      if (result?.granted === true) {
        successDelta++
        newlyGrantedUserIds.push(u.id)
      } else if (result?.reason === "already_granted") {
        successDelta++
      } else if (
        result?.reason === "user_not_found" ||
        result?.reason === "campaign_not_found"
      ) {
        failedDelta++
      } else {
        successDelta++
      }
    }

    const [campaign] = await db
      .select({
        name: surpriseBonusCampaign.name,
        pointsPerUser: surpriseBonusCampaign.pointsPerUser,
        processedUsers: surpriseBonusCampaign.processedUsers,
        successCount: surpriseBonusCampaign.successCount,
        failedCount: surpriseBonusCampaign.failedCount,
      })
      .from(surpriseBonusCampaign)
      .where(eq(surpriseBonusCampaign.id, campaignId))
      .limit(1)

    const processedUsers = (campaign?.processedUsers ?? 0) + batch.length
    const successCount = (campaign?.successCount ?? 0) + successDelta
    const failedCount = (campaign?.failedCount ?? 0) + failedDelta
    const hasMore = batch.length === BATCH_SIZE
    const campaignStatus = hasMore ? ("processing" as const) : ("completed" as const)

    const campaignUpdate: {
      processedUsers: number
      successCount: number
      failedCount: number
      status: "processing" | "completed"
      updatedAt: Date
      completedAt?: Date
    } = {
      processedUsers,
      successCount,
      failedCount,
      status: campaignStatus,
      updatedAt: new Date(),
    }
    if (!hasMore) {
      campaignUpdate.completedAt = new Date()
    }

    await db
      .update(surpriseBonusCampaign)
      .set(campaignUpdate)
      .where(eq(surpriseBonusCampaign.id, campaignId))

    if (hasMore) {
      const nextLastId = batch[batch.length - 1]!.id
      await db.insert(backgroundJobs).values({
        type: SURPRISE_BONUS_JOB_TYPE,
        payload: { campaignId, lastUserId: nextLastId },
        status: "pending",
        attempts: 0,
        maxAttempts: 5,
        availableAt: new Date(),
      })
    }

    await db
      .update(backgroundJobs)
      .set({
        status: "completed",
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      })
      .where(eq(backgroundJobs.id, job.id))

    let pushSentTo = 0
    if (newlyGrantedUserIds.length > 0 && campaign) {
      const pushResult = await sendSurpriseBonusPushToUsers({
        userIds: newlyGrantedUserIds,
        campaignId,
        campaignName: campaign.name,
        pointsPerUser: campaign.pointsPerUser,
      })
      pushSentTo = pushResult.sent
    }

    return {
      claimed: true,
      jobId: job.id,
      campaignId,
      batchSize: batch.length,
      successDelta,
      failedDelta,
      hasMore,
      campaignStatus,
      pushSentTo,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await failOrRetryJob(job, message)
    throw e
  }
}

/**
 * Drain pending surprise_bonus_batch jobs until the queue is empty for this run.
 * Used after enqueue in local/dev so Top-up credits users without Cron.
 */
export async function drainSurpriseBonusJobs(options?: {
  maxBatches?: number
}): Promise<{ batches: number; last?: ProcessBatchResult }> {
  const maxBatches = options?.maxBatches ?? 10_000
  let batches = 0
  let last: ProcessBatchResult | undefined

  while (batches < maxBatches) {
    const result = await processOneSurpriseBonusBatch()
    if (!result.claimed) break
    batches++
    last = result
    if (!result.hasMore) break
  }

  return { batches, last }
}

async function failOrRetryJob(job: ClaimedJob, lastError: string): Promise<void> {
  const attempts = job.attempts ?? 1
  const maxAttempts = job.max_attempts ?? 5

  if (attempts >= maxAttempts) {
    await db
      .update(backgroundJobs)
      .set({
        status: "failed",
        lastError,
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      })
      .where(eq(backgroundJobs.id, job.id))
    return
  }

  const delayMinutes = Math.min(attempts * 2, 30)
  await db
    .update(backgroundJobs)
    .set({
      status: "pending",
      lastError,
      availableAt: new Date(Date.now() + delayMinutes * 60_000),
      lockedAt: null,
      lockedBy: null,
    })
    .where(eq(backgroundJobs.id, job.id))
}
