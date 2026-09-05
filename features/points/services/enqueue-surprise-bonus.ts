import { after } from "next/server"
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
      /** True when production scheduled drain after the response (Vercel `after`). */
      scheduledAfterResponse?: boolean
    }
  | { error: string }

/**
 * Create campaign + first background job.
 * - Local/dev (or SURPRISE_BONUS_SYNC_PROCESS=true): drains the queue inline.
 * - Production: returns quickly, then drains via Next.js `after()`; Vercel cron
 *   `/api/cron/process-surprise-bonus` continues if the after() work is cut short.
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

  let processedInline = false
  let scheduledAfterResponse = false

  if (shouldSyncProcessSurpriseBonus()) {
    await drainSurpriseBonusJobs({ maxBatches })
    processedInline = true
  } else {
    // Production path: do not block the HTTP response; keep draining after it is sent.
    after(() => {
      drainSurpriseBonusJobs({ maxBatches }).catch((e) => {
        console.error("[surprise-bonus] after() drain failed:", e)
      })
    })
    scheduledAfterResponse = true
  }

  return {
    success: true,
    campaignId: campaign.id,
    totalUsers,
    pointsPerUser: points,
    campaignName,
    processedInline,
    scheduledAfterResponse,
  }
}
