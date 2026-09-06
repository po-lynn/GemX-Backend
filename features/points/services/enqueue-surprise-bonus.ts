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
      /** True when jobs were drained in this request (default path). */
      processedInline?: boolean
      /** True when SURPRISE_BONUS_SYNC_PROCESS=false scheduled drain after the response. */
      scheduledAfterResponse?: boolean
    }
  | { error: string }

function appOrigin(): string | null {
  const raw =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_SERVER_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  if (!raw) return null
  return raw.replace(/\/$/, "")
}

/** Kick Vercel cron in a separate invocation (backup when inline is disabled). */
function kickProcessCronInBackground(): void {
  const secret = process.env.CRON_SECRET?.trim()
  const origin = appOrigin()
  if (!secret || !origin) return

  const url = `${origin}/api/cron/process-surprise-bonus`
  after(() => {
    fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    }).catch((e) => {
      console.error("[surprise-bonus] cron kick failed:", e)
    })
  })
}

/**
 * Create campaign + first background job, then credit users.
 * Default: drain the queue **inline** in this request (works on Vercel without Edge/cron).
 * Set SURPRISE_BONUS_SYNC_PROCESS=false to use after()+cron only (large campaigns / dedicated worker).
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
    try {
      const drained = await drainSurpriseBonusJobs({ maxBatches })
      processedInline = true
      // Also clear any older pending jobs left from previous stuck campaigns.
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
        error: `Campaign created but crediting failed: ${message}. Check RPCs (claim_background_job / grant_surprise_bonus_user) and retry cron.`,
      }
    }
  } else {
    after(() => {
      drainSurpriseBonusJobs({ maxBatches }).catch((e) => {
        console.error("[surprise-bonus] after() drain failed:", e)
      })
    })
    kickProcessCronInBackground()
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
