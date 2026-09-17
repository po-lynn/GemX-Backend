// Mute/ban enforcement for chat, deliberately separate from Better Auth's global
// user.banned (a site-wide sign-in ban that the send path doesn't check today).
// See drizzle/schema/chat-moderation-schema.ts for why liftedAt (not a hard delete)
// is how a restriction is "removed" — the row is evidence of prior abuse.

import { and, desc, eq, gt, isNull, or } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { messagingRestriction, type messagingRestrictionTypeEnum } from "@/drizzle/schema/chat-moderation-schema"
import { escrowChatAuditLog } from "@/drizzle/schema/chat-moderation-schema"
import { user } from "@/drizzle/schema/auth-schema"

export type RestrictionType = (typeof messagingRestrictionTypeEnum.enumValues)[number]

export type ActiveRestriction = {
  id: string
  restrictionType: RestrictionType
  reason: string
  expiresAt: Date | null
}

export type RestrictionRow = ActiveRestriction & {
  userId: string
  userName: string | null
  issuedByAdminId: string | null
  issuedByName: string | null
  startsAt: Date
  liftedAt: Date | null
  liftedByAdminId: string | null
  liftReason: string | null
  createdAt: Date
}

/**
 * The one check the send paths call. A restriction is "active" when it hasn't been
 * lifted and (for a mute) hasn't expired — a ban's expiresAt is null (indefinite).
 * Returns the most recent active row (a user shouldn't have more than one at a time
 * in practice, but if they do, the newest wins).
 */
export async function getActiveRestriction(userId: string): Promise<ActiveRestriction | null> {
  const now = new Date()
  const [row] = await db
    .select({
      id: messagingRestriction.id,
      restrictionType: messagingRestriction.restrictionType,
      reason: messagingRestriction.reason,
      expiresAt: messagingRestriction.expiresAt,
    })
    .from(messagingRestriction)
    .where(
      and(
        eq(messagingRestriction.userId, userId),
        isNull(messagingRestriction.liftedAt),
        or(isNull(messagingRestriction.expiresAt), gt(messagingRestriction.expiresAt, now))
      )
    )
    .orderBy(desc(messagingRestriction.createdAt))
    .limit(1)
  return row ?? null
}

export async function listRestrictions(params: { userId?: string; activeOnly?: boolean }): Promise<RestrictionRow[]> {
  const now = new Date()
  const conditions = []
  if (params.userId) conditions.push(eq(messagingRestriction.userId, params.userId))
  if (params.activeOnly) {
    conditions.push(
      and(
        isNull(messagingRestriction.liftedAt),
        or(isNull(messagingRestriction.expiresAt), gt(messagingRestriction.expiresAt, now))
      )!
    )
  }

  const rows = await db
    .select({
      id: messagingRestriction.id,
      userId: messagingRestriction.userId,
      userName: user.name,
      restrictionType: messagingRestriction.restrictionType,
      reason: messagingRestriction.reason,
      issuedByAdminId: messagingRestriction.issuedByAdminId,
      startsAt: messagingRestriction.startsAt,
      expiresAt: messagingRestriction.expiresAt,
      liftedAt: messagingRestriction.liftedAt,
      liftedByAdminId: messagingRestriction.liftedByAdminId,
      liftReason: messagingRestriction.liftReason,
      createdAt: messagingRestriction.createdAt,
    })
    .from(messagingRestriction)
    .innerJoin(user, eq(user.id, messagingRestriction.userId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(messagingRestriction.createdAt))
    .limit(200)

  const adminIds = [...new Set(rows.flatMap((r) => [r.issuedByAdminId, r.liftedByAdminId]).filter((v): v is string => !!v))]
  const admins = adminIds.length
    ? await db.select({ id: user.id, name: user.name }).from(user).where(
        adminIds.length === 1 ? eq(user.id, adminIds[0]) : or(...adminIds.map((id) => eq(user.id, id)))
      )
    : []
  const adminNameById = new Map(admins.map((a) => [a.id, a.name]))

  return rows.map((r) => ({
    ...r,
    issuedByName: r.issuedByAdminId ? adminNameById.get(r.issuedByAdminId) ?? null : null,
  }))
}

/**
 * Issues a mute (expiresAt required, a duration) or ban (expiresAt null, indefinite)
 * and records the audit row in the same transaction — a restriction with no audit
 * trail would defeat the point of it being reviewable.
 */
export async function issueRestriction(params: {
  userId: string
  restrictionType: RestrictionType
  reason: string
  expiresAt: Date | null
  issuedByAdminId: string
}): Promise<RestrictionRow> {
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(messagingRestriction)
      .values({
        userId: params.userId,
        restrictionType: params.restrictionType,
        reason: params.reason,
        expiresAt: params.expiresAt,
        issuedByAdminId: params.issuedByAdminId,
      })
      .returning()
    if (!inserted) throw new Error("Failed to insert messaging restriction")

    await tx.insert(escrowChatAuditLog).values({
      actorId: params.issuedByAdminId,
      actionType: params.restrictionType === "mute" ? "user_muted" : "user_banned",
      targetType: "user",
      targetId: params.userId,
      afterState: { restrictionType: params.restrictionType, expiresAt: params.expiresAt?.toISOString() ?? null },
      reason: params.reason,
    })

    const [issuedByRow] = await tx.select({ name: user.name }).from(user).where(eq(user.id, params.issuedByAdminId)).limit(1)
    const [userRow] = await tx.select({ name: user.name }).from(user).where(eq(user.id, params.userId)).limit(1)

    return {
      ...inserted,
      userName: userRow?.name ?? null,
      issuedByName: issuedByRow?.name ?? null,
    }
  })
}

export class RestrictionNotFoundError extends Error {
  constructor(id: string) {
    super(`Messaging restriction ${id} not found`)
    this.name = "RestrictionNotFoundError"
  }
}

export async function liftRestriction(params: {
  restrictionId: string
  liftedByAdminId: string
  liftReason: string
}): Promise<void> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ id: messagingRestriction.id, userId: messagingRestriction.userId, liftedAt: messagingRestriction.liftedAt })
      .from(messagingRestriction)
      .where(eq(messagingRestriction.id, params.restrictionId))
      .limit(1)
    if (!current) throw new RestrictionNotFoundError(params.restrictionId)

    await tx
      .update(messagingRestriction)
      .set({
        liftedAt: new Date(),
        liftedByAdminId: params.liftedByAdminId,
        liftReason: params.liftReason,
      })
      .where(eq(messagingRestriction.id, params.restrictionId))

    await tx.insert(escrowChatAuditLog).values({
      actorId: params.liftedByAdminId,
      actionType: "user_restriction_lifted",
      targetType: "user",
      targetId: current.userId,
      beforeState: { restrictionId: current.id },
      reason: params.liftReason,
    })
  })
}
