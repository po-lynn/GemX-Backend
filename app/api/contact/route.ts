import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { db } from "@/drizzle/db"
import { contactMessage } from "@/drizzle/schema/contact-message-schema"
import { messages } from "@/drizzle/schema/chat-schema"
import { jsonError, jsonUncached } from "@/lib/api"
import { rateLimit } from "@/lib/rate-limit"
import { CONTACT_SYSTEM_USER_ID } from "@/features/contact/constants"
import { getEscrowServiceChatUser } from "@/features/escrow-service-settings/db/escrow-service-settings"
import { sendChatMessageNotification } from "@/features/notifications/services/chat-notifications"
import { broadcastChatEvents } from "@/lib/supabase/chat-broadcast"

const bodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().min(1, "Email is required").email("Invalid email address").max(320),
  message: z.string().trim().min(1, "Message is required").max(5000),
})

function getIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"
}

/**
 * Best-effort delivery of a contact-form submission into the assigned escrow
 * officer's chat inbox, sent from the placeholder `CONTACT_SYSTEM_USER_ID`
 * account (see features/contact/constants.ts). Never throws — a failure here
 * must not fail the contact submission, which is already durably saved in
 * `contact_message`.
 */
async function deliverToEscrowOfficerChat(input: {
  name: string
  email: string
  message: string
}): Promise<void> {
  try {
    const { configured, user: officer } = await getEscrowServiceChatUser()
    if (!configured || !officer) return

    const content = `New contact form message\nFrom: ${input.name} (${input.email})\n\n${input.message}`

    const [saved] = await db
      .insert(messages)
      .values({
        senderId: CONTACT_SYSTEM_USER_ID,
        recipientId: officer.id,
        content,
        messageType: "text",
        isRead: false,
      })
      .returning({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        content: messages.content,
        fileUrl: messages.fileUrl,
        imageUrls: messages.imageUrls,
        messageType: messages.messageType,
        isRead: messages.isRead,
        starred: messages.starred,
        editedAt: messages.editedAt,
        createdAt: messages.createdAt,
      })
    if (!saved) return

    void sendChatMessageNotification({
      messageId: saved.id,
      senderId: CONTACT_SYSTEM_USER_ID,
      recipientId: officer.id,
      senderName: "Website Contact Form",
      preview: content,
    }).catch((e) => console.error("Contact form chat push notification failed:", e))

    const broadcastPayload = {
      id: saved.id,
      senderId: saved.senderId,
      recipientId: saved.recipientId,
      content: saved.content,
      fileUrl: saved.fileUrl,
      imageUrls: saved.imageUrls ?? null,
      messageType: saved.messageType,
      isRead: saved.isRead ?? false,
      starred: saved.starred ?? false,
      editedAt: saved.editedAt?.toISOString?.() ?? null,
      createdAt: saved.createdAt?.toISOString?.() ?? String(saved.createdAt),
    }
    void broadcastChatEvents([
      { userId: officer.id, event: "new_message", payload: broadcastPayload },
    ]).catch((e) => console.error("Contact form chat broadcast failed:", e))
  } catch (e) {
    console.error("deliverToEscrowOfficerChat:", e)
  }
}

/**
 * POST /api/contact
 * Public "Contact us" form submission from an anonymous website visitor.
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const rl = rateLimit(`contact:${getIp(request)}`, 5, 60_000)
    if (!rl.allowed) {
      return Response.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400)
    }

    const { name, email, message } = parsed.data

    const [row] = await db
      .insert(contactMessage)
      .values({ name, email, message, status: "pending" })
      .returning({ id: contactMessage.id, createdAt: contactMessage.createdAt })

    if (!row) return jsonError("Failed to save message", 500)

    await deliverToEscrowOfficerChat({ name, email, message })

    return jsonUncached({
      success: true,
      id: row.id,
      createdAt: row.createdAt,
    })
  } catch (e) {
    console.error("POST /api/contact:", e)
    return jsonError("Failed to submit contact message", 500)
  }
}
