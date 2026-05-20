import { db } from "@/drizzle/db";
import { userDevice } from "@/drizzle/schema/user-devices-schema";
import type { RegisterUserDeviceInput, UserDeviceRecord } from "@/features/notifications/types";
import { and, eq, inArray } from "drizzle-orm";

export async function upsertUserDevice(input: RegisterUserDeviceInput): Promise<void> {
  const now = new Date();
  await db
    .insert(userDevice)
    .values({
      userId: input.userId,
      fcmToken: input.fcmToken,
      platform: input.platform ?? null,
      deviceId: input.deviceId ?? null,
      deviceName: input.deviceName ?? null,
      deviceModel: input.deviceModel ?? null,
      osVersion: input.osVersion ?? null,
      appVersion: input.appVersion ?? null,
      lastActiveAt: now,
    })
    .onConflictDoUpdate({
      target: [userDevice.userId, userDevice.fcmToken],
      set: {
        platform: input.platform ?? null,
        deviceId: input.deviceId ?? null,
        deviceName: input.deviceName ?? null,
        deviceModel: input.deviceModel ?? null,
        osVersion: input.osVersion ?? null,
        appVersion: input.appVersion ?? null,
        lastActiveAt: now,
        updatedAt: now,
      },
    });
}

export async function touchUserDevice(userId: string, fcmToken: string): Promise<void> {
  const now = new Date();
  await db
    .update(userDevice)
    .set({ lastActiveAt: now, updatedAt: now })
    .where(and(eq(userDevice.userId, userId), eq(userDevice.fcmToken, fcmToken)));
}

export async function removeUserDevice(userId: string, fcmToken: string): Promise<void> {
  await db
    .delete(userDevice)
    .where(and(eq(userDevice.userId, userId), eq(userDevice.fcmToken, fcmToken)));
}

export async function removeUserDevicesByFcmTokens(fcmTokens: string[]): Promise<number> {
  if (fcmTokens.length === 0) return 0;
  const deleted = await db
    .delete(userDevice)
    .where(inArray(userDevice.fcmToken, fcmTokens))
    .returning({ id: userDevice.id });
  return deleted.length;
}

export async function getFcmTokensByUserIds(
  userIds: string[]
): Promise<Record<string, string[]>> {
  if (userIds.length === 0) return {};
  const rows = await db
    .select({ userId: userDevice.userId, fcmToken: userDevice.fcmToken })
    .from(userDevice)
    .where(inArray(userDevice.userId, userIds));
  const byUser: Record<string, string[]> = {};
  for (const r of rows) {
    if (!byUser[r.userId]) byUser[r.userId] = [];
    byUser[r.userId].push(r.fcmToken);
  }
  return byUser;
}

export async function getAllFcmTokens(opts?: { role?: string }): Promise<
  { fcmToken: string; userId: string }[]
> {
  if (!opts?.role) {
    return db
      .select({ fcmToken: userDevice.fcmToken, userId: userDevice.userId })
      .from(userDevice);
  }
  const { user } = await import("@/drizzle/schema/auth-schema");
  return db
    .select({ fcmToken: userDevice.fcmToken, userId: userDevice.userId })
    .from(userDevice)
    .innerJoin(user, eq(user.id, userDevice.userId))
    .where(eq(user.role, opts.role));
}

/** Device list for admin UI (grouped by user). */
export async function getUserDevicesByUserIds(
  userIds: string[]
): Promise<Record<string, { token: string; platform: string | null }[]>> {
  if (userIds.length === 0) return {};
  const rows = await db
    .select({
      userId: userDevice.userId,
      token: userDevice.fcmToken,
      platform: userDevice.platform,
    })
    .from(userDevice)
    .where(inArray(userDevice.userId, userIds));
  const byUser: Record<string, { token: string; platform: string | null }[]> = {};
  for (const r of rows) {
    if (!byUser[r.userId]) byUser[r.userId] = [];
    byUser[r.userId].push({ token: r.token, platform: r.platform });
  }
  return byUser;
}

export async function getUserDevicesForUser(userId: string): Promise<UserDeviceRecord[]> {
  const rows = await db.select().from(userDevice).where(eq(userDevice.userId, userId));
  return rows.map(mapRow);
}

function mapRow(row: typeof userDevice.$inferSelect): UserDeviceRecord {
  return {
    id: row.id,
    userId: row.userId,
    fcmToken: row.fcmToken,
    platform: row.platform,
    deviceId: row.deviceId,
    deviceName: row.deviceName,
    deviceModel: row.deviceModel,
    osVersion: row.osVersion,
    appVersion: row.appVersion,
    lastActiveAt: row.lastActiveAt,
  };
}
