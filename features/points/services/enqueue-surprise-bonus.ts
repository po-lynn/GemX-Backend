import {
  countActiveUsers,
  createSurpriseBonusCampaign,
  enqueueSurpriseBonusBatchJob,
  markSurpriseBonusCampaignProcessing,
} from "@/features/points/db/surprise-bonus"
import { drainSurpriseBonusJobs } from "@/features/points/services/process-surprise-bonus-jobs"

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
 * Create campaign + first background job, then credit users inline in this
 * request (no cron / background worker involved). If a very large campaign's
 * drain gets cut off by `maxDuration`, the next Top-up submission reclaims
 * the stranded job automatically (`claim_background_job`, migration 0087).
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

  await enqueueSurpriseBonusBatchJob({
    campaignId: campaign.id,
    lastUserId: null,
  })

  await markSurpriseBonusCampaignProcessing(campaign.id)

  // Cap batches from known user count (+ slack) so a stuck queue cannot loop forever.
  const maxBatches = Math.max(1, Math.ceil(totalUsers / 100) + 2)

  try {
    const drained = await drainSurpriseBonusJobs({ maxBatches })
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

  return {
    success: true,
    campaignId: campaign.id,
    totalUsers,
    pointsPerUser: points,
    campaignName,
    processedInline: true,
  }
}
