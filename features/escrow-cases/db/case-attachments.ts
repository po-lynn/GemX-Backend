import { desc, eq } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { escrowCaseAttachment } from "@/drizzle/schema/escrow-case-schema"
import { messageTypeEnum } from "@/drizzle/schema/chat-schema"

export type EscrowCaseAttachmentFileType = (typeof messageTypeEnum.enumValues)[number]

export type EscrowCaseAttachmentItem = {
  id: string
  caseId: string
  messageId: string | null
  uploadedByUserId: string | null
  url: string
  fileType: EscrowCaseAttachmentFileType
  label: string | null
  createdAt: string
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

/** All evidence for a case, newest first — linked to the case itself (item 6 of the
 *  brief's scope), not only to whichever message happened to carry it. */
export async function listEscrowCaseAttachments(caseId: string): Promise<EscrowCaseAttachmentItem[]> {
  const rows = await db
    .select()
    .from(escrowCaseAttachment)
    .where(eq(escrowCaseAttachment.caseId, caseId))
    .orderBy(desc(escrowCaseAttachment.createdAt))

  return rows.map((r) => ({
    id: r.id,
    caseId: r.caseId,
    messageId: r.messageId,
    uploadedByUserId: r.uploadedByUserId,
    url: r.url,
    fileType: r.fileType,
    label: r.label,
    createdAt: toIso(r.createdAt),
  }))
}

export async function createEscrowCaseAttachment(input: {
  caseId: string
  uploadedByUserId: string
  url: string
  fileType: EscrowCaseAttachmentFileType
  label?: string | null
  messageId?: string | null
}): Promise<EscrowCaseAttachmentItem> {
  const [row] = await db
    .insert(escrowCaseAttachment)
    .values({
      caseId: input.caseId,
      messageId: input.messageId ?? null,
      uploadedByUserId: input.uploadedByUserId,
      url: input.url,
      fileType: input.fileType,
      label: input.label ?? null,
    })
    .returning()

  if (!row) throw new Error("Failed to record escrow case attachment")
  return {
    id: row.id,
    caseId: row.caseId,
    messageId: row.messageId,
    uploadedByUserId: row.uploadedByUserId,
    url: row.url,
    fileType: row.fileType,
    label: row.label,
    createdAt: toIso(row.createdAt),
  }
}
