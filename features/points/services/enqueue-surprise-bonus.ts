import { SURPRISE_BONUS_JOB_TYPE, SURPRISE_BONUS_PUSH_JOB_TYPE } from "@/drizzle/schema/surprise-bonus-schema"
import {
  countActiveUsers,
  createSurpriseBonusCampaign,
  markSurpriseBonusCampaignProcessing,
} from "@/features/points/db/surprise-bonus"
import { processSurpriseBonusJob } from "@/features/points/services/process-surprise-bonus-jobs"
import { processSurpriseBonusPushJob } from "@/features/points/services/process-surprise-bonus-push-jobs"
import { drainJobs } from "@/lib/queue/drain"
import { enqueueJob } from "@/lib/queue/queue"

export type EnqueueSurpriseBonusInput = {
  campaignName: string
  pointsPerUser: number
  note?: string
  createdBy: string
}

export type EnqueueSurpriseBonusResult =
  | {
      success: true
      campaignId: string
      totalUsers: number
      pointsPerUser: number
      campaignName: string
      /** Always true: jobs are drained in this request before responding. */
      processedInline: true
    }
  | { error: string }

/**
 * Create campaign + first background job, then credit users and send their
 * push notifications inline in this request (no cron / background worker
 * involved). If a very large campaign's credit drain gets cut off by
 * `maxDuration`, the next Top-up submission reclaims the stranded job
 * automatically (`claim_background_job`, migration 0087). A push-drain
 * failure is logged but never turns a successful credit run into an error —
 * it's recoverable from /admin/queue.
 */
export async function enqueueSurpriseBonusForAllUsers(
  input: EnqueueSurpriseBonusInput,
): Promise<EnqueueSurpriseBonusResult> {
  const points = Math.floor(Number(input.pointsPerUser))
  if (isNaN(points) || points <= 0) {
    return { error: "Amount must be a positive number." }
  }

  const campaignName = input.campaignName.trim()
  if (!campaignName) return { error: "Campaign name is required." }

  const totalUsers = await countActiveUsers()
  if (totalUsers === 0) return { error: "No active users found." }

  const campaign = await createSurpriseBonusCampaign({
    name: campaignName,
    pointsPerUser: points,
    note: input.note,
    totalUsers,
    createdBy: input.createdBy,
  })

  await enqueueJob(SURPRISE_BONUS_JOB_TYPE, { campaignId: campaign.id, lastUserId: null })

  await markSurpriseBonusCampaignProcessing(campaign.id)

  // Cap batches from known user count (+ slack) so a stuck queue cannot loop forever.
  const maxBatches = Math.max(1, Math.ceil(totalUsers / 100) + 2)

  try {
    const drained = await drainJobs(SURPRISE_BONUS_JOB_TYPE, processSurpriseBonusJob, { maxBatches })
    if (drained.batches === 0) {
      console.warn(
        "[surprise-bonus] inline drain claimed 0 batches — check claim_background_job RPC / pending jobs",
        { campaignId: campaign.id },
      )
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[surprise-bonus] inline drain failed:", e)
    return {
      error: `Campaign created but crediting failed: ${message}. Check RPCs (claim_background_job / grant_surprise_bonus_user) and retry the Top-up.`,
    }
  }

  try {
    await drainJobs(SURPRISE_BONUS_PUSH_JOB_TYPE, processSurpriseBonusPushJob, { maxBatches })
  } catch (e) {
    // Credits already committed — a push failure only affects notification
    // delivery, which is recoverable from /admin/queue (retry or delete), so
    // it must not turn an otherwise-successful campaign into an error response.
    console.error("[surprise-bonus] push drain failed (recoverable from /admin/queue):", e)
  }

  return {
    success: true,
    campaignId: campaign.id,
    totalUsers,
    pointsPerUser: points,
    campaignName,
    processedInline: true,
  }
}
