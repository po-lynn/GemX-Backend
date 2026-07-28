"use server";

import { sendPushNotificationToUserIds } from "@/features/notifications/services/send-push-notification";

/** Welcome push after successful registration. */
export async function sendWelcomeNotification(
  userId: string,
  userName?: string | null
): Promise<void> {
  const name = userName?.trim() || "there";
  await sendPushNotificationToUserIds([userId], {
    title: "Welcome to GemX!",
    body: `Hi ${name}, thanks for joining. Start exploring gemstones and jewellery.`,
    data: {
      type: "welcome",
      screen: "home",
    },
  }).catch((e) => console.error("Welcome push failed:", e));
}
