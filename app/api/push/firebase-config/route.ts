import { connection } from "next/server";
import { jsonCached, jsonError } from "@/lib/api";
import { getFirebaseWebClientConfig, isFirebaseWebPushConfigured } from "@/data/env/client";

/** Public Firebase web config for service worker registration (no secrets). */
export async function GET() {
  await connection();
  try {
    if (!isFirebaseWebPushConfigured()) {
      return jsonError("Firebase web push is not configured", 503);
    }
    return jsonCached({
      ...getFirebaseWebClientConfig(),
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });
  } catch (e) {
    console.error("GET /api/push/firebase-config:", e);
    return jsonError("Failed to load Firebase config", 500);
  }
}
