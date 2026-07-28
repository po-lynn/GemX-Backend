import { upsertUserDevice } from "@/features/notifications/db/user-devices";
import { sendWelcomeNotification } from "@/features/notifications/services/auth-notifications";
import type { MobileDevicePayload } from "@/features/notifications/schemas/device";

/**
 * After login/register: persist FCM token (if provided) and send lifecycle push.
 * Login events only persist the device token — no push is sent on plain login.
 */
export async function handleAuthDeviceAndNotifications(params: {
  userId: string;
  userName?: string | null;
  event: "login" | "register";
  device?: MobileDevicePayload;
}): Promise<void> {
  const { userId, userName, event, device } = params;
  const fcmToken = device?.fcmToken;

  if (fcmToken) {
    await upsertUserDevice({
      userId,
      fcmToken,
      platform: device?.platform ?? null,
      deviceId: device?.deviceId ?? null,
      deviceName: device?.deviceName ?? null,
      deviceModel: device?.deviceModel ?? null,
      osVersion: device?.osVersion ?? null,
      appVersion: device?.appVersion ?? null,
    });
  }

  if (event === "register") {
    await sendWelcomeNotification(userId, userName);
  }
}
