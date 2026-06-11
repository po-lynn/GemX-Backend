import { getUserDevicesByUserIds } from "@/features/notifications/db/user-devices";

export async function getPushTokensByUserIds(
  userIds: string[]
): Promise<Record<string, { token: string; platform: string | null }[]>> {
  return getUserDevicesByUserIds(userIds);
}
