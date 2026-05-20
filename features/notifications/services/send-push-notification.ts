"use server";

import { getFirebaseAdmin } from "@/features/notifications/firebase/admin";
import {
  getAllFcmTokens,
  getFcmTokensByUserIds,
  removeUserDevicesByFcmTokens,
} from "@/features/notifications/db/user-devices";
import type { PushNotificationPayload, PushSendResult } from "@/features/notifications/types";

const INVALID_TOKEN_ERROR_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

function buildMulticastMessage(
  tokens: string[],
  payload: PushNotificationPayload
): import("firebase-admin/messaging").MulticastMessage {
  return {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body ?? "",
    },
    data: payload.data
      ? Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, String(v)]))
      : undefined,
    android: { priority: "high" },
    apns: { payload: { aps: { sound: "default" } } },
  };
}

/**
 * Reusable FCM sender. Sends to raw token list, prunes invalid tokens from `user_devices`.
 */
export async function sendPushNotification(
  fcmTokens: string[],
  payload: PushNotificationPayload
): Promise<PushSendResult> {
  const uniqueTokens = Array.from(new Set(fcmTokens.filter(Boolean)));
  if (uniqueTokens.length === 0) {
    return { sent: 0, failed: 0, invalidTokensRemoved: 0 };
  }

  const admin = await getFirebaseAdmin();
  if (!admin) {
    console.warn("Push skipped: FCM not configured (set FIREBASE_* env)");
    return { sent: 0, failed: uniqueTokens.length, invalidTokensRemoved: 0 };
  }

  try {
    const result = await admin.messaging().sendEachForMulticast(buildMulticastMessage(uniqueTokens, payload));
    const invalidTokens: string[] = [];
    result.responses.forEach((response, index) => {
      if (response.success) return;
      const code = response.error?.code;
      if (code && INVALID_TOKEN_ERROR_CODES.has(code)) {
        invalidTokens.push(uniqueTokens[index]);
      }
    });
    const invalidTokensRemoved = await removeUserDevicesByFcmTokens(invalidTokens);
    return {
      sent: result.successCount,
      failed: result.failureCount,
      invalidTokensRemoved,
    };
  } catch (e) {
    console.error("FCM send failed:", e);
    return { sent: 0, failed: uniqueTokens.length, invalidTokensRemoved: 0 };
  }
}

/** Send push to specific users (all registered devices per user). */
export async function sendPushNotificationToUserIds(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<PushSendResult> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) {
    return { sent: 0, failed: 0, invalidTokensRemoved: 0 };
  }
  const tokensByUser = await getFcmTokensByUserIds(uniqueUserIds);
  const tokens = Object.values(tokensByUser).flat();
  return sendPushNotification(tokens, payload);
}

/** Broadcast to all registered devices (optionally filter by user role). */
export async function sendPushNotificationToAll(
  payload: PushNotificationPayload,
  opts?: { role?: string }
): Promise<PushSendResult> {
  const rows = await getAllFcmTokens(opts);
  return sendPushNotification(
    rows.map((r) => r.fcmToken),
    payload
  );
}
