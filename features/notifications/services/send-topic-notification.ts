"use server";

import { getFirebaseAdmin } from "@/features/notifications/firebase/admin";
import { createPushError, normalizeFirebaseError } from "@/features/notifications/errors";
import type { PushNotificationPayload, TopicPushResult } from "@/features/notifications/types";

function stringifyData(data?: Record<string, string>): Record<string, string> | undefined {
  if (!data || Object.keys(data).length === 0) return undefined;
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => [k, String(v)])
  );
}

function buildTopicMessage(
  topic: string,
  payload: PushNotificationPayload
): import("firebase-admin/messaging").Message {
  return {
    topic,
    notification: {
      title: payload.title,
      body: payload.body ?? "",
    },
    data: stringifyData(payload.data),
    android: {
      priority: "high",
      notification: {
        clickAction: "FLUTTER_NOTIFICATION_CLICK",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          category: "GLOBAL",
        },
      },
    },
  };
}

/**
 * Send a push notification to an FCM topic (no per-device tokens or user auth).
 * Devices subscribe client-side, e.g. Flutter: `FirebaseMessaging.instance.subscribeToTopic('global')`.
 */
export async function sendPushToTopic(
  topic: string,
  payload: PushNotificationPayload
): Promise<TopicPushResult> {
  const trimmedTopic = topic.trim();
  if (!trimmedTopic) {
    return {
      success: false,
      error: createPushError("INVALID_PAYLOAD", "FCM topic is required"),
    };
  }
  if (!payload.title?.trim()) {
    return {
      success: false,
      error: createPushError("INVALID_PAYLOAD", "Notification title is required"),
    };
  }

  const admin = await getFirebaseAdmin();
  if (!admin) {
    console.warn("Topic push skipped: FCM not configured (set FIREBASE_* env)");
    return {
      success: false,
      error: createPushError(
        "FCM_NOT_CONFIGURED",
        "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY."
      ),
    };
  }

  try {
    const messageId = await admin.messaging().send(buildTopicMessage(trimmedTopic, payload));
    return { success: true, messageId, topic: trimmedTopic };
  } catch (e) {
    const error = normalizeFirebaseError(e);
    console.error(`FCM topic send failed [${trimmedTopic}]:`, error.message, error.cause ?? "");
    return { success: false, error };
  }
}
