import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireEscrowCaseAccess, requireEscrowThreadWriteAccess } from "@/features/escrow-cases/lib/case-access"
import { listEscrowCaseMessages, sendEscrowCaseMessage } from "@/features/escrow-cases/db/case-messages"
import { broadcastCaseEvents } from "@/lib/supabase/case-broadcast"
import { sendEscrowCaseMessageNotification } from "@/features/notifications/services/escrow-case-notifications"

const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(5000),
})

/** GET /api/admin/escrow-cases/[id]/messages — any access scope may read, including
 *  read-only "moderation" oversight. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await context.params
  const access = await requireEscrowCaseAccess(request, id)
  if (!access.ok) return access.error

  try {
    const messages = await listEscrowCaseMessages(id)
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
    const saved = await sendEscrowCaseMessage({
      caseId: id,
      senderId,
      content: parsed.data.content,
    })

    void broadcastCaseEvents(id, [{ event: "case_message_new", payload: saved }]).catch((e) =>
      console.error("Escrow case broadcast failed:", e)
    )

    const [sender] = await db.select({ name: user.name }).from(user).where(eq(user.id, senderId)).limit(1)
    const recipientIds = [access.case.buyerId, access.case.sellerId, access.case.assignedAgentId].filter(
      (candidateId): candidateId is string => !!candidateId
    )
    void sendEscrowCaseMessageNotification({
      caseId: id,
      messageId: saved.id,
      senderId,
      senderName: sender?.name?.trim() || "Someone",
      recipientIds,
      preview: saved.content,
    }).catch((e) => console.error("Escrow case push notification failed:", e))

    return jsonUncached({ success: true, message: saved })
  } catch (error) {
    console.error("POST /api/admin/escrow-cases/[id]/messages:", error)
    return jsonError("Failed to send message", 500)
  }
}
