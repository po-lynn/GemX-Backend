import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { surpriseBonusCampaign, SURPRISE_BONUS_JOB_TYPE } from "@/drizzle/schema/surprise-bonus-schema"
import { backgroundJobs } from "@/drizzle/schema/queue-schema"
import { and, desc, eq, sql } from "drizzle-orm"

/** Matches the reclaim window in claim_background_job (migration 0087). */
const STALE_AFTER_MS = 3 * 60 * 1000

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

export async function enqueueSurpriseBonusBatchJob(input: {
  campaignId: string
  lastUserId: string | null
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(backgroundJobs)
    .values({
      type: SURPRISE_BONUS_JOB_TYPE,
      payload: {
        campaignId: input.campaignId,
        lastUserId: input.lastUserId,
      },
      status: "pending",
      attempts: 0,
      maxAttempts: 5,
      availableAt: new Date(),
    })
    .returning({ id: backgroundJobs.id })
  return row
}

export async function markSurpriseBonusCampaignProcessing(
  campaignId: string,
): Promise<void> {
  await db
    .update(surpriseBonusCampaign)
    .set({
      status: "processing",
      startedAt: new Date(),
      updatedAt: new Date(),
    })
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

export type SurpriseBonusJobRow = {
  id: string
  status: string
  attempts: number
  maxAttempts: number
  availableAt: Date
  lockedAt: Date | null
  lockedBy: string | null
  lastError: string | null
  createdAt: Date
  completedAt: Date | null
  campaignId: string | null
  campaignName: string | null
  /** `processing` and locked longer than claim_background_job's reclaim window (0087). */
  isStale: boolean
}

export type SurpriseBonusJobStatusCounts = {
  pending: number
  processing: number
  completed: number
  failed: number
  stale: number
}

const jobCampaignId = sql<string | null>`${backgroundJobs.payload}->>'campaignId'`

/** Most recent surprise-bonus background jobs, newest first, with their campaign name. */
export async function listSurpriseBonusJobs(limit = 100): Promise<SurpriseBonusJobRow[]> {
  const rows = await db
    .select({
      id: backgroundJobs.id,
      status: backgroundJobs.status,
      attempts: backgroundJobs.attempts,
      maxAttempts: backgroundJobs.maxAttempts,
      availableAt: backgroundJobs.availableAt,
      lockedAt: backgroundJobs.lockedAt,
      lockedBy: backgroundJobs.lockedBy,
      lastError: backgroundJobs.lastError,
      createdAt: backgroundJobs.createdAt,
      completedAt: backgroundJobs.completedAt,
      campaignId: jobCampaignId,
      campaignName: surpriseBonusCampaign.name,
    })
    .from(backgroundJobs)
    .leftJoin(surpriseBonusCampaign, eq(jobCampaignId, surpriseBonusCampaign.id))
    .where(eq(backgroundJobs.type, SURPRISE_BONUS_JOB_TYPE))
    .orderBy(desc(backgroundJobs.createdAt))
    .limit(limit)

  const now = Date.now()
  return rows.map((r) => ({
    ...r,
    isStale:
      r.status === "processing" &&
      r.lockedAt !== null &&
      now - r.lockedAt.getTime() > STALE_AFTER_MS,
  }))
}

/** Status breakdown across all surprise-bonus jobs (not just the listed page). */
export async function getSurpriseBonusJobStatusCounts(): Promise<SurpriseBonusJobStatusCounts> {
  const [row] = await db
    .select({
      pending: sql<number>`count(*) filter (where status = 'pending')::int`,
      processing: sql<number>`count(*) filter (where status = 'processing')::int`,
      completed: sql<number>`count(*) filter (where status = 'completed')::int`,
      failed: sql<number>`count(*) filter (where status = 'failed')::int`,
      stale: sql<number>`count(*) filter (
        where status = 'processing' and locked_at < now() - interval '3 minutes'
      )::int`,
    })
    .from(backgroundJobs)
    .where(eq(backgroundJobs.type, SURPRISE_BONUS_JOB_TYPE))
  return row ?? { pending: 0, processing: 0, completed: 0, failed: 0, stale: 0 }
}
