import { and, asc, eq, gt, sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import {
  surpriseBonusCampaign,
  SURPRISE_BONUS_JOB_TYPE,
  SURPRISE_BONUS_PUSH_JOB_TYPE,
} from "@/drizzle/schema/surprise-bonus-schema"
import { describeSurpriseBonusJobs } from "@/features/points/db/surprise-bonus"
import { enqueueJob, normalizeRows } from "@/lib/queue/queue"
import { registerQueueJob } from "@/lib/queue/registry"
import type { ClaimedQueueJob, QueueJobResult } from "@/lib/queue/types"

const BATCH_SIZE = 100

type SurpriseBonusPayload = { campaignId?: string; lastUserId?: string | null }
type GrantResult = { granted?: boolean; reason?: string; points?: number }

/**
 * The registered lib/queue handler for SURPRISE_BONUS_JOB_TYPE. Claiming,
 * completing, and retry/backoff are all handled by lib/queue/drain.ts's
 * drainJobs — this function only implements the surprise-bonus-specific
 * batch: grant up to BATCH_SIZE users, update campaign progress, enqueue a
 * push job for newly granted users (SURPRISE_BONUS_PUSH_JOB_TYPE — kept
 * separate so a push failure never blocks or retries credit batches), and
 * chain the next batch if more users remain. Returns a per-batch summary
 * that lib/queue records on the job row, surfaced as expandable detail on
 * /admin/queue.
 */
export async function processSurpriseBonusJob(job: ClaimedQueueJob): Promise<QueueJobResult> {
  const payload = job.payload as SurpriseBonusPayload
  const campaignId = payload.campaignId
  if (!campaignId) throw new Error("Missing campaignId in payload")

  const lastUserId = payload.lastUserId ?? null

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
  let alreadyGrantedDelta = 0
  const newlyGrantedUserIds: string[] = []

  for (const u of batch) {
    const grantRows = normalizeRows<{ result: GrantResult | string }>(
      await db.execute(sql`SELECT grant_surprise_bonus_user(${campaignId}, ${u.id}) AS result`),
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
      alreadyGrantedDelta++
    } else if (result?.reason === "user_not_found" || result?.reason === "campaign_not_found") {
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
  if (!hasMore) campaignUpdate.completedAt = new Date()

  await db.update(surpriseBonusCampaign).set(campaignUpdate).where(eq(surpriseBonusCampaign.id, campaignId))

  if (hasMore) {
    const nextLastId = batch[batch.length - 1]!.id
    await enqueueJob(SURPRISE_BONUS_JOB_TYPE, { campaignId, lastUserId: nextLastId })
  }

  if (newlyGrantedUserIds.length > 0 && campaign) {
    await enqueueJob(SURPRISE_BONUS_PUSH_JOB_TYPE, {
      campaignId,
      campaignName: campaign.name,
      pointsPerUser: campaign.pointsPerUser,
      userIds: newlyGrantedUserIds,
    })
  }

  return {
    batchUsers: batch.length,
    newlyGranted: newlyGrantedUserIds.length,
    alreadyGranted: alreadyGrantedDelta,
    failed: failedDelta,
    pushJobEnqueued: newlyGrantedUserIds.length > 0,
  }
}

registerQueueJob({
  type: SURPRISE_BONUS_JOB_TYPE,
  label: "Surprise Bonus",
  handler: processSurpriseBonusJob,
  describeJobs: describeSurpriseBonusJobs,
})
