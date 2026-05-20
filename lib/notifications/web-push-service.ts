"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
  type MessagePayload,
} from "firebase/messaging";
import {
  env,
  getFirebaseWebClientConfig,
  isFirebaseWebPushConfigured,
} from "@/data/env/client";
import { webPushLogger } from "@/lib/notifications/logger";
import { parseNotificationData, resolveNotificationPath } from "@/lib/notifications/navigation";
import type { FcmMessageHandler, WebPushInitResult } from "@/lib/notifications/types";

const SW_PATH = "/firebase-messaging-sw.js";
const GLOBAL_SUBSCRIBE_URL = "/api/push/global/subscribe";

/**
 * Reusable web push service: permission, FCM token, global topic subscription, foreground messages.
 * No user authentication required.
 */
export class WebPushNotificationService {
  private app: FirebaseApp | null = null;
  private messaging: Messaging | null = null;
  private currentToken: string | null = null;
  private initialized = false;

  async initialize(onForegroundMessage?: FcmMessageHandler): Promise<WebPushInitResult> {
    if (typeof window === "undefined") {
      return { ok: false, reason: "unsupported", message: "Not in browser" };
    }

    if (!isFirebaseWebPushConfigured()) {
      webPushLogger.warn("Firebase web push env not configured; skipping");
      return { ok: false, reason: "not_configured" };
    }

    const supported = await isSupported().catch(() => false);
    if (!supported) {
      webPushLogger.warn("FCM is not supported in this browser");
      return { ok: false, reason: "unsupported" };
    }

    const permission = await this.requestPermission();
    if (permission !== "granted") {
      webPushLogger.warn("Notification permission not granted", { permission });
      return { ok: false, reason: "denied", message: permission };
    }

    try {
      const config = getFirebaseWebClientConfig()!;
      this.app = getApps().length > 0 ? getApps()[0]! : initializeApp(config);
      await this.registerServiceWorker(config);
      this.messaging = getMessaging(this.app);

      const token = await getToken(this.messaging, {
        vapidKey: env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!,
        serviceWorkerRegistration: await navigator.serviceWorker.ready,
      });

      if (!token) {
        return { ok: false, reason: "error", message: "Empty FCM token" };
      }

      this.currentToken = token;
      await this.subscribeTokenToGlobalTopic(token);

      if (onForegroundMessage) {
        onMessage(this.messaging, onForegroundMessage);
      }

      this.initialized = true;
      webPushLogger.info("Web push initialized and subscribed to global topic");
      return { ok: true, token };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      webPushLogger.error("Web push initialization failed", { message });
      return { ok: false, reason: "error", message };
    }
  }

  /** Request browser notification permission (call on app load). */
  async requestPermission(): Promise<NotificationPermission> {
    if (!("Notification" in window)) {
      return "denied";
    }
    if (Notification.permission === "granted") {
      return "granted";
    }
    if (Notification.permission === "denied") {
      return "denied";
    }
    return Notification.requestPermission();
  }

  getToken(): string | null {
    return this.currentToken;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /** Navigate from FCM message data (foreground tap handler). */
  static resolvePathFromMessage(payload: MessagePayload): string {
    return resolveNotificationPath(parseNotificationData(payload.data as Record<string, string>));
  }

  private async registerServiceWorker(
    config: ReturnType<typeof getFirebaseWebClientConfig>
  ): Promise<ServiceWorkerRegistration> {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers not supported");
    }
    const query = new URLSearchParams({
      firebaseConfig: JSON.stringify(config),
    });
    const swUrl = `${SW_PATH}?${query.toString()}`;
    const registration = await navigator.serviceWorker.register(swUrl);
    webPushLogger.info("Service worker registered", { scope: registration.scope });
    return registration;
  }

  private async subscribeTokenToGlobalTopic(token: string): Promise<void> {
    const res = await fetch(GLOBAL_SUBSCRIBE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        typeof body?.error === "string" ? body.error : `Subscribe failed (${res.status})`
      );
    }
    webPushLogger.info("Subscribed FCM token to global topic via backend");
  }
}

let singleton: WebPushNotificationService | null = null;

export function getWebPushNotificationService(): WebPushNotificationService {
  if (!singleton) {
    singleton = new WebPushNotificationService();
  }
  return singleton;
}
