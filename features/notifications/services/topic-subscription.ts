"use server";

import { FCM_GLOBAL_TOPIC } from "@/features/notifications/constants";
import { getFirebaseAdmin } from "@/features/notifications/firebase/admin";
import { createPushError, normalizeFirebaseError } from "@/features/notifications/errors";
import { notificationLogger } from "@/features/notifications/logger";
import type { PushNotificationError } from "@/features/notifications/errors";

export type TopicSubscriptionResult =
  | { success: true; topic: string; successCount: number; failureCount: number }
  | { success: false; error: PushNotificationError };

async function mutateTopicSubscription(
  tokens: string[],
  topic: string,
  action: "subscribe" | "unsubscribe"
): Promise<TopicSubscriptionResult> {
  const uniqueTokens = Array.from(new Set(tokens.map((t) => t.trim()).filter(Boolean)));
  if (uniqueTokens.length === 0) {
    return {
      success: false,
      error: createPushError("INVALID_PAYLOAD", "FCM token is required"),
    };
  }

  const admin = await getFirebaseAdmin();
  if (!admin) {
    notificationLogger.warn("Topic subscription skipped: Firebase Admin not configured");
    return {
      success: false,
      error: createPushError(
        "FCM_NOT_CONFIGURED",
        "Firebase Admin is not configured. Set FIREBASE_* environment variables."
      ),
    };
  }

  try {
    const response =
      action === "subscribe"
        ? await admin.messaging().subscribeToTopic(uniqueTokens, topic)
        : await admin.messaging().unsubscribeFromTopic(uniqueTokens, topic);

    notificationLogger.info(`FCM topic ${action}`, {
      topic,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    if (response.failureCount > 0 && response.errors?.length) {
      notificationLogger.warn(`FCM topic ${action} partial failure`, {
        errors: response.errors.slice(0, 3),
      });
    }

    if (response.failureCount === 0) {
      return { success: true as const, topic, successCount: response.successCount, failureCount: response.failureCount };
    }
    return { success: false as const, error: createPushError("FCM_SEND_FAILED", `${response.failureCount} token(s) failed for topic ${topic}`) };
  } catch (e) {
    const error = normalizeFirebaseError(e);
    notificationLogger.error(`FCM topic ${action} failed`, { topic, error: error.message });
    return { success: false, error };
  }
}

/** Subscribe a web/mobile FCM token to the global broadcast topic (no user auth). */
export async function subscribeTokenToGlobalTopic(fcmToken: string): Promise<TopicSubscriptionResult> {
  return mutateTopicSubscription([fcmToken], FCM_GLOBAL_TOPIC, "subscribe");
}

export async function unsubscribeTokenFromGlobalTopic(
  fcmToken: string
): Promise<TopicSubscriptionResult> {
  return mutateTopicSubscription([fcmToken], FCM_GLOBAL_TOPIC, "unsubscribe");
}
