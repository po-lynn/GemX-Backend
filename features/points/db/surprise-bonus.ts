import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import {
  backgroundJobs,
  surpriseBonusCampaign,
  SURPRISE_BONUS_JOB_TYPE,
} from "@/drizzle/schema/surprise-bonus-schema"
import { and, eq, sql } from "drizzle-orm"

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
