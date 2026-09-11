import { SURPRISE_BONUS_PUSH_JOB_TYPE } from "@/drizzle/schema/surprise-bonus-schema"
import { sendSurpriseBonusPushToUsers } from "@/features/points/services/surprise-bonus-push"
import { registerQueueJob } from "@/lib/queue/registry"
import type { ClaimedQueueJob, QueueJobResult, QueueJobRow } from "@/lib/queue/types"

type SurpriseBonusPushPayload = {
  campaignId?: string
  campaignName?: string
  pointsPerUser?: number
  userIds?: string[]
}

/**
 * The registered lib/queue handler for SURPRISE_BONUS_PUSH_JOB_TYPE. One job
 * per credit batch's newly-granted user ids, enqueued by
 * processSurpriseBonusJob. Only a genuine send failure (FCM misconfigured,
 * API error, etc.) throws — a batch where everyone simply has no registered
 * device (`sent: 0, failed: 0`) is a normal outcome, not a job failure.
 * Returns a send summary that lib/queue records on the job row, surfaced as
 * expandable detail on /admin/queue.
 */
export async function processSurpriseBonusPushJob(job: ClaimedQueueJob): Promise<QueueJobResult> {
  const payload = job.payload as SurpriseBonusPushPayload
  const { campaignId, campaignName, pointsPerUser, userIds } = payload
  if (!campaignId || !campaignName || !pointsPerUser || !Array.isArray(userIds) || userIds.length === 0) {
    throw new Error("Invalid surprise bonus push payload")
  }

  const result = await sendSurpriseBonusPushToUsers({ userIds, campaignId, campaignName, pointsPerUser })
  if (result.sent === 0 && result.failed > 0) {
    throw new Error(`Push send failed for all ${result.failed} recipient(s)`)
  }

  return {
    recipients: userIds.length,
    sent: result.sent,
    failed: result.failed,
    invalidTokensRemoved: result.invalidTokensRemoved,
  }
}

/** Batch-enrich queue admin rows with their campaign name — already carried in the payload, no DB lookup needed. */
export async function describeSurpriseBonusPushJobs(jobs: QueueJobRow[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  for (const job of jobs) {
    const campaignName = (job.payload as SurpriseBonusPushPayload).campaignName
    if (campaignName) result.set(job.id, campaignName)
  }
  return result
}

registerQueueJob({
  type: SURPRISE_BONUS_PUSH_JOB_TYPE,
  label: "Surprise Bonus Push",
  handler: processSurpriseBonusPushJob,
  describeJobs: describeSurpriseBonusPushJobs,
})
