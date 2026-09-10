import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { surpriseBonusCampaign, SURPRISE_BONUS_JOB_TYPE } from "@/drizzle/schema/surprise-bonus-schema"
import type { QueueJobRow, QueueJobStatusCounts } from "@/lib/queue/types"
import { getJobStatusCounts, listJobs } from "@/lib/queue/queue"
import { and, eq, inArray, sql } from "drizzle-orm"

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

/** Status breakdown across all surprise-bonus jobs (not just the listed page). */
export async function getSurpriseBonusJobStatusCounts(): Promise<QueueJobStatusCounts> {
  return getJobStatusCounts(SURPRISE_BONUS_JOB_TYPE)
}

export type SurpriseBonusJobRow = QueueJobRow & {
  campaignId: string | null
  campaignName: string | null
}

/** Most recent surprise-bonus background jobs, newest first, with their campaign name. */
export async function listSurpriseBonusJobs(limit = 100): Promise<SurpriseBonusJobRow[]> {
  const rows = await listJobs(SURPRISE_BONUS_JOB_TYPE, limit)

  // Enrich with campaign names
  const nameMap = await describeSurpriseBonusJobs(rows)

  return rows.map((r) => ({
    ...r,
    campaignId: (r.payload as { campaignId?: string }).campaignId ?? null,
    campaignName: nameMap.get(r.id) ?? null,
  })) as SurpriseBonusJobRow[]
}
