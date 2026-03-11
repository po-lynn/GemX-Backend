import { db } from "@/drizzle/db";
import { pushDeviceToken } from "@/drizzle/schema/push-schema";
import { and, eq, inArray } from "drizzle-orm";

export async function upsertPushToken(params: {
  userId: string;
  token: string;
  platform?: string | null;
}): Promise<void> {
  await db
    .insert(pushDeviceToken)
    .values({
      userId: params.userId,
      token: params.token,
      platform: params.platform ?? null,
    })
    .onConflictDoUpdate({
      target: [pushDeviceToken.userId, pushDeviceToken.token],
      set: {
        platform: params.platform ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function removePushToken(userId: string, token: string): Promise<void> {
  await db
    .delete(pushDeviceToken)
    .where(and(eq(pushDeviceToken.userId, userId), eq(pushDeviceToken.token, token)));
}

/** Get all FCM (or other) device tokens for sending push. Optionally filter by role (e.g. "mobile"). */
export async function getAllPushTokens(opts?: { role?: string }): Promise<
  { token: string; userId: string }[]
> {
  if (!opts?.role) {
    return db.select({ token: pushDeviceToken.token, userId: pushDeviceToken.userId }).from(pushDeviceToken);
  }
  const { user } = await import("@/drizzle/schema/auth-schema");
  return db
    .select({ token: pushDeviceToken.token, userId: pushDeviceToken.userId })
    .from(pushDeviceToken)
    .innerJoin(user, eq(user.id, pushDeviceToken.userId))
    .where(eq(user.role, opts.role));
}

/** Get push device tokens grouped by userId for the given user IDs (e.g. for admin users table). */
export async function getPushTokensByUserIds(
  userIds: string[]
): Promise<Record<string, { token: string; platform: string | null }[]>> {
  if (userIds.length === 0) return {};
  const rows = await db
    .select({ userId: pushDeviceToken.userId, token: pushDeviceToken.token, platform: pushDeviceToken.platform })
    .from(pushDeviceToken)
    .where(inArray(pushDeviceToken.userId, userIds));
  const byUser: Record<string, { token: string; platform: string | null }[]> = {};
  for (const r of rows) {
    if (!byUser[r.userId]) byUser[r.userId] = [];
    byUser[r.userId].push({ token: r.token, platform: r.platform });
  }
  return byUser;
}
