"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { MessagePayload } from "firebase/messaging";
import { isFirebaseWebPushConfigured } from "@/data/env/client";
import { getWebPushNotificationService } from "@/lib/notifications/web-push-service";
import { parseNotificationData, resolveNotificationPath } from "@/lib/notifications/navigation";
import { webPushLogger } from "@/lib/notifications/logger";

type Props = {
  children: React.ReactNode;
};

/**
 * Initializes web push on app load: permission → FCM token → subscribe to `global` topic.
 * Handles foreground messages and navigates to article detail on notification data.
 */
export function GlobalPushProvider({ children }: Props) {
  const router = useRouter();
  const initStarted = useRef(false);

  useEffect(() => {
    if (initStarted.current || !isFirebaseWebPushConfigured()) return;
    initStarted.current = true;

    const service = getWebPushNotificationService();

    const onForegroundMessage = (payload: MessagePayload) => {
      webPushLogger.info("Foreground FCM message", { data: payload.data });
      const data = parseNotificationData(payload.data as Record<string, string>);
      const title =
        payload.notification?.title ?? data.articleTitle ?? data.newsTitle ?? "GemX";
      const body = payload.notification?.body ?? "";

      if (typeof window !== "undefined" && Notification.permission === "granted") {
        const n = new Notification(title, {
          body,
          data: payload.data,
          icon: "/favicon.ico",
        });
        n.onclick = () => {
          const path = resolveNotificationPath(data);
          router.push(path);
          n.close();
        };
      }
    };

    service.initialize(onForegroundMessage).then((result) => {
      if (!result.ok) {
        webPushLogger.warn("Web push init skipped", result);
      }
    });
  }, [router]);

  return <>{children}</>;
}
