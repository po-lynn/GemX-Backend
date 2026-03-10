"use server";

import { env } from "@/data/env/server";
import { getAllPushTokens } from "@/features/push/db/push-tokens";

let firebaseAdmin: typeof import("firebase-admin") | null = null;

async function getFirebaseAdmin(): Promise<typeof import("firebase-admin") | null> {
  if (firebaseAdmin) return firebaseAdmin;
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    return null;
  }
  try {
    const admin = (await import("firebase-admin")).default;
    if (admin.apps.length > 0) {
      firebaseAdmin = admin;
      return admin;
    }
    const privateKey = FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
    firebaseAdmin = admin;
    return admin;
  } catch (e) {
    console.error("Firebase Admin init failed:", e);
    return null;
  }
}

export type PushPayload = {
  title: string;
  body?: string;
  /** Custom data for the app (e.g. articleId, screen). */
  data?: Record<string, string>;
};

/**
 * Send push notification to all registered mobile app users (role "mobile").
 * No-op if FCM is not configured or there are no tokens.
 */
export async function sendPushToMobileUsers(payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const tokens = await getAllPushTokens({ role: "mobile" });
  const tokenStrings = tokens.map((t) => t.token).filter(Boolean);
  if (tokenStrings.length === 0) return { sent: 0, failed: 0 };

  const admin = await getFirebaseAdmin();
  if (!admin) {
    console.warn("Push skipped: FCM not configured (set FIREBASE_* env)");
    return { sent: 0, failed: tokenStrings.length };
  }

  const message: import("firebase-admin/messaging").MulticastMessage = {
    tokens: tokenStrings,
    notification: {
      title: payload.title,
      body: payload.body ?? "",
    },
    data: payload.data
      ? Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, String(v)]))
      : undefined,
    android: { priority: "high" as const },
    apns: { payload: { aps: { sound: "default" } } },
  };

  try {
    const result = await admin.messaging().sendEachForMulticast(message);
    return { sent: result.successCount, failed: result.failureCount };
  } catch (e) {
    console.error("FCM send failed:", e);
    return { sent: 0, failed: tokenStrings.length };
  }
}
