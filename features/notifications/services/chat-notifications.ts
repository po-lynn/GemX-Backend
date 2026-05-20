"use server";

import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { isUserViewingPeer } from "@/features/chat/db/active-chat-view";
import { notificationLogger } from "@/features/notifications/logger";
import { buildChatMessageNotificationData } from "@/features/notifications/payloads/chat";
import { sendPushNotificationToUserIds } from "@/features/notifications/services/send-push-notification";
import type {
  ChatMessageNotificationInput,
  ChatMessageNotificationResult,
} from "@/features/notifications/types";
import { eq } from "drizzle-orm";

function truncatePreview(text: string, max = 120): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Send FCM to the message receiver only (all registered devices).
 * Skips when the receiver is actively viewing this conversation.
 */
export async function sendChatMessageNotification(
  input: ChatMessageNotificationInput
): Promise<ChatMessageNotificationResult> {
  const { messageId, senderId, recipientId, preview } = input;

  if (senderId === recipientId) {
    notificationLogger.warn("Chat push skipped: sender equals recipient", { senderId });
    return { sent: false, skipped: true, skipReason: "no_devices" };
  }

  const viewing = await isUserViewingPeer(recipientId, senderId);
  if (viewing) {
    notificationLogger.info("Chat push skipped: receiver viewing conversation", {
      recipientId,
      senderId,
      messageId,
    });
    return { sent: false, skipped: true, skipReason: "receiver_viewing_chat" };
  }

  let senderName = input.senderName?.trim() || null;
  if (!senderName) {
    const [row] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, senderId))
      .limit(1);
    senderName = row?.name?.trim() || "Someone";
  }

  const body = truncatePreview(preview || "New message");
  const data = buildChatMessageNotificationData({
    senderId,
    recipientId,
    messageId,
  });

  const pushResult = await sendPushNotificationToUserIds([recipientId], {
    title: senderName,
    body,
    data,
  });

  if (pushResult.sent === 0 && pushResult.failed === 0) {
    notificationLogger.warn("Chat push: no FCM tokens for receiver", { recipientId, messageId });
    return { sent: false, skipped: true, skipReason: "no_devices", pushResult };
  }

  if (pushResult.sent === 0) {
    notificationLogger.warn("Chat push failed for all tokens", {
      recipientId,
      messageId,
      failed: pushResult.failed,
    });
    return { sent: false, skipped: false, skipReason: "fcm_not_configured", pushResult };
  }

  notificationLogger.info("Chat push sent", {
    recipientId,
    senderId,
    messageId,
    sent: pushResult.sent,
    failed: pushResult.failed,
  });

  return { sent: true, skipped: false, pushResult };
}
