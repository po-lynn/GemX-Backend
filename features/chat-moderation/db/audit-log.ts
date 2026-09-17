// Reader side of escrow_chat_audit_log. Writers already exist, scattered across
// case-transitions.ts, case-messages.ts, restrictions.ts and reports.ts — this is
// the first reader, backing the per-thread and per-user audit trail UI.

import { and, desc, eq } from "drizzle-orm"
import { db } from "@/drizzle/db"
import {
  escrowChatAuditLog,
  escrowChatAuditActionEnum,
  escrowChatAuditTargetEnum,
} from "@/drizzle/schema/chat-moderation-schema"
import { user } from "@/drizzle/schema/auth-schema"

export type EscrowChatAuditAction = (typeof escrowChatAuditActionEnum.enumValues)[number]
export type EscrowChatAuditTarget = (typeof escrowChatAuditTargetEnum.enumValues)[number]

export type AuditLogRow = {
  id: string
  actorId: string | null
  actorName: string | null
  actionType: EscrowChatAuditAction
  targetType: EscrowChatAuditTarget
  targetId: string
  beforeState: Record<string, unknown> | null
  afterState: Record<string, unknown> | null
  reason: string | null
  createdAt: Date
}

async function withActorNames(
  rows: Array<Omit<AuditLogRow, "actorName">>
): Promise<AuditLogRow[]> {
  const { inArray } = await import("drizzle-orm")
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((v): v is string => !!v))]
  const actors = actorIds.length
    ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, actorIds))
    : []
  const nameById = new Map(actors.map((a) => [a.id, a.name]))
  return rows.map((r) => ({ ...r, actorName: r.actorId ? nameById.get(r.actorId) ?? null : null }))
}

/** Every audit row for one target (an escrow case, a user, a report, a message) — the "per-thread/per-user audit trail" view. */
export async function listAuditLogForTarget(targetType: EscrowChatAuditTarget, targetId: string): Promise<AuditLogRow[]> {
  const rows = await db
    .select()
    .from(escrowChatAuditLog)
    .where(and(eq(escrowChatAuditLog.targetType, targetType), eq(escrowChatAuditLog.targetId, targetId)))
    .orderBy(desc(escrowChatAuditLog.createdAt))
    .limit(500)
  return withActorNames(rows)
}

/** Every audit row a given staff member performed — "what has this moderator/agent done." */
export async function listAuditLogForActor(actorId: string): Promise<AuditLogRow[]> {
  const rows = await db
    .select()
    .from(escrowChatAuditLog)
    .where(eq(escrowChatAuditLog.actorId, actorId))
    .orderBy(desc(escrowChatAuditLog.createdAt))
    .limit(500)
  return withActorNames(rows)
}

/** Unfiltered recent feed for the moderation dashboard's audit tab. */
export async function listRecentAuditLog(params: { actionType?: EscrowChatAuditAction } = {}): Promise<AuditLogRow[]> {
  const rows = await db
    .select()
    .from(escrowChatAuditLog)
    .where(params.actionType ? eq(escrowChatAuditLog.actionType, params.actionType) : undefined)
    .orderBy(desc(escrowChatAuditLog.createdAt))
    .limit(200)
  return withActorNames(rows)
}

/** Writes a `thread_viewed` row — called by the read-only oversight viewers (never by a participant's own normal use of their thread). */
export async function recordThreadViewed(params: {
  actorId: string
  targetType: "escrow_case" | "flat_thread"
  targetId: string
}): Promise<void> {
  await db.insert(escrowChatAuditLog).values({
    actorId: params.actorId,
    actionType: "thread_viewed",
    targetType: params.targetType,
    targetId: params.targetId,
  })
}
