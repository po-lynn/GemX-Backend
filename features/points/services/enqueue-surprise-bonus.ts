import {
  countActiveUsers,
  createSurpriseBonusCampaign,
  enqueueSurpriseBonusBatchJob,
  markSurpriseBonusCampaignProcessing,
} from "@/features/points/db/surprise-bonus"
import { drainSurpriseBonusJobs } from "@/features/points/services/process-surprise-bonus-jobs"
import { shouldSyncProcessSurpriseBonus } from "@/features/points/services/should-sync-process-surprise-bonus"

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
      /** True when jobs were drained in this request (local/dev sync path). */
      processedInline?: boolean
    }
  | { error: string }

/**
 * Create campaign + first background job.
 * In production: returns immediately; Edge Cron credits users.
 * In local/dev (or SURPRISE_BONUS_SYNC_PROCESS=true): drains the queue inline.
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

  let processedInline = false
  if (shouldSyncProcessSurpriseBonus()) {
    // Cap batches from known user count (+ slack) so a stuck queue cannot loop forever.
    const maxBatches = Math.max(1, Math.ceil(totalUsers / 100) + 2)
    await drainSurpriseBonusJobs({ maxBatches })
    processedInline = true
  }

  return {
    success: true,
    campaignId: campaign.id,
    totalUsers,
    pointsPerUser: points,
    campaignName,
    processedInline,
  }
}
