import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { escrowCaseMessage, escrowCaseReadCursor } from "@/drizzle/schema/escrow-case-schema"
import { messageTypeEnum } from "@/drizzle/schema/chat-schema"

export type EscrowCaseMessageAttachmentType = (typeof messageTypeEnum.enumValues)[number]
export type EscrowCaseMessageVisibility = "case" | "agent_buyer" | "agent_seller"

export type EscrowCaseMessageItem = {
  id: string
  caseId: string
  senderId: string | null
  kind: "message" | "system"
  visibility: EscrowCaseMessageVisibility
  content: string
  fileUrl: string | null
  imageUrls: string[] | null
  attachmentType: EscrowCaseMessageAttachmentType
  systemEventType: string | null
  systemEventPayload: Record<string, unknown> | null
  createdAt: string
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

/**
 * `includeSideChannel` decides whether `agent_buyer`/`agent_seller` rows come back
 * alongside `case` ones — the caller (the messages route) sets this from the viewer's
 * case-access scope: false for "moderation" (general chat oversight never sees a
 * specific case's confidential side channel), true for admin/supervisor/own (the
 * assigned agent, plus anyone with equivalent full access to this one case). There is
 * no per-party (buyer vs. seller) split here because nothing on this admin-only API
 * surface is ever "the buyer" or "the seller" themselves — see the doc comment in
 * app/api/admin/escrow-cases/[id]/messages/route.ts for why that's the right line to
 * draw today, and what a future buyer/seller-facing surface would need to add.
 *
 * Paginated like /api/chat/history: page 1 is the most recent `limit` rows (queried
 * newest-first, then reversed) so the default call still reads as "the tail of the
 * thread" rather than its oldest messages.
 */
export async function listEscrowCaseMessages(
  caseId: string,
  includeSideChannel: boolean,
  pagination: { page: number; limit: number }
): Promise<{ messages: EscrowCaseMessageItem[]; total: number }> {
  const visibilities: EscrowCaseMessageVisibility[] = includeSideChannel
    ? ["case", "agent_buyer", "agent_seller"]
    : ["case"]
  const whereClause = and(
    eq(escrowCaseMessage.caseId, caseId),
    inArray(escrowCaseMessage.visibility, visibilities)
  )
  const { page, limit } = pagination
  const offset = (page - 1) * limit

  // Sequential, not Promise.all: this route has no timeout wrapper of its own, so keep
  // to at most one pooler connection at a time here (same rationale as chat/history's
  // primary queries).
  const rows = await db
    .select()
    .from(escrowCaseMessage)
    .where(whereClause)
    .orderBy(desc(escrowCaseMessage.createdAt))
    .limit(limit)
    .offset(offset)
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(escrowCaseMessage)
    .where(whereClause)

  const messages = rows
    .map((r) => ({
      id: r.id,
      caseId: r.caseId,
      senderId: r.senderId,
      kind: r.kind,
      visibility: r.visibility,
      content: r.content,
      fileUrl: r.fileUrl,
      imageUrls: r.imageUrls ?? null,
      attachmentType: r.attachmentType,
      systemEventType: r.systemEventType,
      systemEventPayload: r.systemEventPayload,
      createdAt: toIso(r.createdAt),
    }))
    .reverse()

  return { messages, total: countRows[0]?.count ?? 0 }
}

/**
 * A case-thread message (`kind: "message"`), `visibility` defaulting to "case" (the
 * shared buyer+seller+agent thread) or explicitly "agent_buyer"/"agent_seller" — the
 * agent (or a supervisor/admin covering for them) messaging one party privately from
 * within the case. Never disguised as a group message: the visibility value is stored
 * on the row itself and rendered distinctly (see EscrowCaseThreadView.tsx).
 */
export async function sendEscrowCaseMessage(input: {
  caseId: string
  senderId: string
  content: string
  visibility?: EscrowCaseMessageVisibility
  fileUrl?: string | null
  imageUrls?: string[] | null
  attachmentType?: EscrowCaseMessageAttachmentType
}): Promise<EscrowCaseMessageItem> {
  const [row] = await db
    .insert(escrowCaseMessage)
    .values({
      caseId: input.caseId,
      senderId: input.senderId,
      kind: "message",
      visibility: input.visibility ?? "case",
      content: input.content,
      fileUrl: input.fileUrl ?? null,
      imageUrls: input.imageUrls ?? null,
      attachmentType: input.attachmentType ?? "text",
    })
    .returning()

  if (!row) throw new Error("Failed to send escrow case message")
  return {
    id: row.id,
    caseId: row.caseId,
    senderId: row.senderId,
    kind: row.kind,
    visibility: row.visibility,
    content: row.content,
    fileUrl: row.fileUrl,
    imageUrls: row.imageUrls ?? null,
    attachmentType: row.attachmentType,
    systemEventType: row.systemEventType,
    systemEventPayload: row.systemEventPayload,
    createdAt: toIso(row.createdAt),
  }
}

export async function markEscrowCaseRead(caseId: string, userId: string): Promise<void> {
  await db
    .insert(escrowCaseReadCursor)
    .values({ caseId, userId })
    .onConflictDoUpdate({
      target: [escrowCaseReadCursor.caseId, escrowCaseReadCursor.userId],
      set: { lastReadAt: new Date() },
    })
}
