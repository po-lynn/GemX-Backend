import { and, asc, eq } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { escrowCaseMessage, escrowCaseReadCursor } from "@/drizzle/schema/escrow-case-schema"
import { messageTypeEnum } from "@/drizzle/schema/chat-schema"

export type EscrowCaseMessageAttachmentType = (typeof messageTypeEnum.enumValues)[number]

export type EscrowCaseMessageItem = {
  id: string
  caseId: string
  senderId: string | null
  kind: "message" | "system"
  visibility: "case" | "agent_buyer" | "agent_seller"
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

/** visibility = "case" only for now — side-channel (agent_buyer/agent_seller) messages
 *  are added in a later step, along with the viewer-scoped filtering they need. */
export async function listEscrowCaseMessages(caseId: string): Promise<EscrowCaseMessageItem[]> {
  const rows = await db
    .select()
    .from(escrowCaseMessage)
    .where(and(eq(escrowCaseMessage.caseId, caseId), eq(escrowCaseMessage.visibility, "case")))
    .orderBy(asc(escrowCaseMessage.createdAt))

  return rows.map((r) => ({
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
}

/** Ordinary case-thread message (visibility "case", kind "message") from a real participant. */
export async function sendEscrowCaseMessage(input: {
  caseId: string
  senderId: string
  content: string
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
      visibility: "case",
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
