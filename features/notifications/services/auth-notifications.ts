"use server";

import type { RegisterUserDeviceInput } from "@/features/notifications/types";
import { sendPushNotificationToUserIds } from "@/features/notifications/services/send-push-notification";

function deviceLabel(device?: Pick<RegisterUserDeviceInput, "deviceName" | "deviceModel" | "platform">): string {
  if (device?.deviceName) return device.deviceName;
  if (device?.deviceModel) return device.deviceModel;
  if (device?.platform === "android") return "Android device";
  if (device?.platform === "ios") return "iOS device";
  return "a new device";
}

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

/** Login alert push after successful sign-in. */
export async function sendLoginNotification(
  userId: string,
  device?: Pick<RegisterUserDeviceInput, "deviceName" | "deviceModel" | "platform">
): Promise<void> {
  const label = deviceLabel(device);
  await sendPushNotificationToUserIds([userId], {
    title: "New sign-in to GemX",
    body: `Your account was accessed from ${label}. If this wasn't you, change your password.`,
    data: {
      type: "login",
      screen: "profile",
    },
  }).catch((e) => console.error("Login push failed:", e));
}
