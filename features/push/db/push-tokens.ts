import {
  getAllFcmTokens,
  getFcmTokensByUserIds,
  getUserDevicesByUserIds,
  removeUserDevice,
  upsertUserDevice,
} from "@/features/notifications/db/user-devices";

/** @deprecated Use upsertUserDevice from @/features/notifications/db/user-devices */
export async function upsertPushToken(params: {
  userId: string;
  token: string;
  platform?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  deviceModel?: string | null;
  osVersion?: string | null;
  appVersion?: string | null;
}): Promise<void> {
  await upsertUserDevice({
    userId: params.userId,
    fcmToken: params.token,
    platform: params.platform === "android" || params.platform === "ios" ? params.platform : null,
    deviceId: params.deviceId,
    deviceName: params.deviceName,
    deviceModel: params.deviceModel,
    osVersion: params.osVersion,
    appVersion: params.appVersion,
  });
}

/** @deprecated Use removeUserDevice */
export async function removePushToken(userId: string, token: string): Promise<void> {
  await removeUserDevice(userId, token);
}

export async function getAllPushTokens(opts?: { role?: string }): Promise<
  { token: string; userId: string }[]
> {
  const rows = await getAllFcmTokens(opts);
  return rows.map((r) => ({ token: r.fcmToken, userId: r.userId }));
}

export async function getPushTokensByUserIds(
  userIds: string[]
): Promise<Record<string, { token: string; platform: string | null }[]>> {
  return getUserDevicesByUserIds(userIds);
}
