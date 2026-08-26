import { db } from "@/drizzle/db"
import { messages } from "@/drizzle/schema/chat-schema"
import {
  GEMX_NOTIFICATIONS_SYSTEM_USER_ID,
  GEMX_NOTIFICATIONS_SYSTEM_USER_NAME,
} from "@/features/points/constants/monthly-bonus-notify"
import { getTopUpCampaignNotifyCopy } from "@/features/points/constants/topup-campaign-notify"
import { sendChatMessageNotification } from "@/features/notifications/services/chat-notifications"
import { broadcastChatEvents } from "@/lib/supabase/chat-broadcast"

/**
 * After a successful campaign top-up credit: insert a GemX system chat message
 * and fire chat push + realtime broadcast. Never throws.
 */
export async function notifyTopUpCampaignGranted(input: {
  userId: string
  amount: number
  campaignName: string
}): Promise<void> {
  try {
    const { title, body, content } = getTopUpCampaignNotifyCopy(
      input.amount,
      input.campaignName,
      "en",
    )

    const [saved] = await db
      .insert(messages)
      .values({
        senderId: GEMX_NOTIFICATIONS_SYSTEM_USER_ID,
        recipientId: input.userId,
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
      senderId: GEMX_NOTIFICATIONS_SYSTEM_USER_ID,
      recipientId: input.userId,
      senderName: GEMX_NOTIFICATIONS_SYSTEM_USER_NAME,
      title,
      preview: body,
    }).catch((e) =>
      console.error("[topup-campaign] chat push notification failed:", e),
    )

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
      {
        userId: input.userId,
        event: "new_message",
        payload: broadcastPayload,
      },
    ]).catch((e) =>
      console.error("[topup-campaign] chat broadcast failed:", e),
    )
  } catch (e) {
    console.error("[topup-campaign] notifyTopUpCampaignGranted:", e)
  }
}
