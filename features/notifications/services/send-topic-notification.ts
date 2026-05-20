"use server";

import { getFirebaseAdmin } from "@/features/notifications/firebase/admin";
import { createPushError, normalizeFirebaseError } from "@/features/notifications/errors";
import { notificationLogger } from "@/features/notifications/logger";
import type { PushNotificationPayload, TopicPushResult } from "@/features/notifications/types";

function stringifyData(data?: Record<string, string>): Record<string, string> | undefined {
  if (!data || Object.keys(data).length === 0) return undefined;
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => [k, String(v)])
  );
}

function absoluteUrl(path: string): string {
  const base = (
    process.env.NEXT_PUBLIC_SERVER_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
  return path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildTopicMessage(
  topic: string,
  payload: PushNotificationPayload
): import("firebase-admin/messaging").Message {
  const data = stringifyData(payload.data);
  const link = data?.link ? absoluteUrl(data.link) : undefined;

  return {
    topic,
    notification: {
      title: payload.title,
      body: payload.body ?? "",
    },
    data,
    webpush: link
      ? {
          notification: {
            title: payload.title,
            body: payload.body ?? "",
          },
          fcmOptions: { link },
        }
      : undefined,
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
    notificationLogger.warn("Topic push skipped: FCM not configured (set FIREBASE_* env)");
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
    notificationLogger.info("FCM topic message sent", { topic: trimmedTopic, messageId });
    return { success: true, messageId, topic: trimmedTopic };
  } catch (e) {
    const error = normalizeFirebaseError(e);
    notificationLogger.error(`FCM topic send failed [${trimmedTopic}]`, {
      message: error.message,
      cause: error.cause,
    });
    return { success: false, error };
  }
}
