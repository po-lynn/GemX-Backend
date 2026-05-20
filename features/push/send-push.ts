"use server";

import {
  sendPushNotificationToAll,
  sendPushNotificationToUserIds,
} from "@/features/notifications/services/send-push-notification";
import type { PushNotificationPayload } from "@/features/notifications/types";

/** @deprecated Use PushNotificationPayload from @/features/notifications/types */
export type PushPayload = PushNotificationPayload;

/**
 * Send push notification to all mobile app users (anyone with a registered device).
 * No-op if FCM is not configured or there are no tokens.
 */
export async function sendPushToMobileUsers(
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const result = await sendPushNotificationToAll(payload);
  return { sent: result.sent, failed: result.failed };
}

/** Send push notification to specific users by user id. */
export async function sendPushToUserIds(
  userIds: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const result = await sendPushNotificationToUserIds(userIds, payload);
  return { sent: result.sent, failed: result.failed };
}

export { sendChatMessageNotification } from "@/features/notifications/services/chat-notifications";
