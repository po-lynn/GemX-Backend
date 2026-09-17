import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { escrowCaseMessageVisibilityEnum } from "@/drizzle/schema/escrow-case-schema"
import { escrowChatAuditLog } from "@/drizzle/schema/chat-moderation-schema"
import { messageTypeEnum } from "@/drizzle/schema/chat-schema"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireEscrowCaseAccess, requireEscrowThreadWriteAccess } from "@/features/escrow-cases/lib/case-access"
import { listEscrowCaseMessages, sendEscrowCaseMessage } from "@/features/escrow-cases/db/case-messages"
import { createEscrowCaseAttachment } from "@/features/escrow-cases/db/case-attachments"
import { broadcastCaseEvents } from "@/lib/supabase/case-broadcast"
import { sendEscrowCaseMessageNotification } from "@/features/notifications/services/escrow-case-notifications"
import { getActiveRestriction } from "@/features/chat-moderation/db/restrictions"
import { recordThreadViewed } from "@/features/chat-moderation/db/audit-log"

const sendMessageSchema = z
  .object({
    content: z.string().trim().max(5000).optional(),
    visibility: z.enum(escrowCaseMessageVisibilityEnum.enumValues).optional(),
    fileUrl: z.string().trim().url().max(2000).optional(),
    imageUrls: z.array(z.string().trim().url()).min(1).max(1).optional(),
    attachmentType: z.enum(messageTypeEnum.enumValues).optional(),
  })
  // Matches /api/chat/messages's own rule: a caption is optional once there's a file —
  // an agent sharing a payment slip shouldn't be forced to type something first.
  .refine((v) => !!v.content?.trim() || !!v.fileUrl || (v.imageUrls && v.imageUrls.length > 0), {
    message: "content, fileUrl, or imageUrls is required",
  })

/**
 * GET /api/admin/escrow-cases/[id]/messages — any access scope may read the shared
 * "case" thread. Side-channel (`agent_buyer`/`agent_seller`) rows are additionally
 * withheld from the read-only "moderation" scope: general chat oversight doesn't imply
 * access to one specific case's confidential agent<->party notes. There is no per-party
 * (buyer-only vs. seller-only) split here because this whole API surface is admin/staff
 * -only — nothing calling it is ever "the buyer" or "the seller" themselves. A future
 * buyer/seller-facing surface (mobile, out of scope today) would need its own query that
 * filters agent_buyer to the buyer and agent_seller to the seller specifically.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await context.params
  const access = await requireEscrowCaseAccess(request, id)
  if (!access.ok) return access.error

  try {
    const messages = await listEscrowCaseMessages(id, access.scope !== "moderation")

    // Oversight, not casework: a moderator's own GET of a case they aren't assigned to
    // is exactly the "read-only audited thread viewer" from the brief — every such view
    // is logged, and (per the brief) the case's actual participants are never notified.
    // admin/supervisor/own reads are ordinary casework and are not logged here — logging
    // an agent's every poll of their own assigned case would drown the audit trail in
    // noise with no oversight value.
    if (access.scope === "moderation") {
      await recordThreadViewed({ actorId: access.session.user.id, targetType: "escrow_case", targetId: id })
    }

    return jsonUncached({ success: true, messages })
  } catch (error) {
    console.error("GET /api/admin/escrow-cases/[id]/messages:", error)
    return jsonError("Failed to load messages", 500)
  }
}

/**
 * POST /api/admin/escrow-cases/[id]/messages — the case-thread send path. Deliberately a
 * wholly separate function against escrow_case_message, never the flat `messages` table —
 * routing an operator post through the existing flat-table insert would be the exact thing
 * the brief forbids ("never inject a hidden operator message into a private buyer-seller
 * thread"). Rejects the read-only "moderation" scope (moderators get oversight, not
 * escrow-thread participation).
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await context.params
  const access = await requireEscrowThreadWriteAccess(request, id)
  if (!access.ok) return access.error

  try {
    const parsed = sendMessageSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return jsonError("Invalid input", 400)

    const senderId = access.session.user.id

    const restriction = await getActiveRestriction(senderId)
    if (restriction) {
      return jsonError(
        restriction.restrictionType === "ban"
          ? `You are banned from messaging: ${restriction.reason}`
          : `You are muted from messaging until ${restriction.expiresAt?.toISOString() ?? "further notice"}: ${restriction.reason}`,
        403
      )
    }

    const visibility = parsed.data.visibility ?? "case"
    const fileUrl = parsed.data.imageUrls?.[0] ?? parsed.data.fileUrl ?? null
    const saved = await sendEscrowCaseMessage({
      caseId: id,
      senderId,
      content: parsed.data.content ?? "",
      visibility,
      fileUrl: parsed.data.fileUrl,
      imageUrls: parsed.data.imageUrls,
      attachmentType: parsed.data.attachmentType,
    })

    void broadcastCaseEvents(id, [{ event: "case_message_new", payload: saved }]).catch((e) =>
      console.error("Escrow case broadcast failed:", e)
    )

    // A message-borne attachment is ALSO recorded as case-level evidence (item 6 of the
    // brief's scope: "stored against the case, not only against the message") — awaited,
    // not fire-and-forget, so evidence is never silently missing from the case's record.
    if (fileUrl) {
      await createEscrowCaseAttachment({
        caseId: id,
        messageId: saved.id,
        uploadedByUserId: senderId,
        url: fileUrl,
        fileType: saved.attachmentType,
      })
    }

    // Awaited, not fire-and-forget: a side-channel message with no audit trail defeats
    // the point of it being independently auditable (item 12 of the brief's scope).
    if (visibility !== "case") {
      await db.insert(escrowChatAuditLog).values({
        actorId: senderId,
        actionType: "side_channel_message_sent",
        targetType: "case_message",
        targetId: saved.id,
        afterState: { visibility },
      })
    }

    // Side-channel recipients are scoped to the one party it's addressed to, plus the
    // agent — the other party must never even learn a private message was sent (not
    // just be unable to read its content). The shared "case" thread still notifies both.
    const recipientIds =
      visibility === "agent_buyer"
        ? [access.case.buyerId, access.case.assignedAgentId]
        : visibility === "agent_seller"
          ? [access.case.sellerId, access.case.assignedAgentId]
          : [access.case.buyerId, access.case.sellerId, access.case.assignedAgentId]

    const [sender] = await db.select({ name: user.name }).from(user).where(eq(user.id, senderId)).limit(1)
    void sendEscrowCaseMessageNotification({
      caseId: id,
      messageId: saved.id,
      senderId,
      senderName: sender?.name?.trim() || "Someone",
      recipientIds: recipientIds.filter((candidateId): candidateId is string => !!candidateId),
      preview: saved.content,
    }).catch((e) => console.error("Escrow case push notification failed:", e))

    return jsonUncached({ success: true, message: saved })
  } catch (error) {
    console.error("POST /api/admin/escrow-cases/[id]/messages:", error)
    return jsonError("Failed to send message", 500)
  }
}
