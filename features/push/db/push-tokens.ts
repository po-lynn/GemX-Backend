import { db } from "@/drizzle/db";
import { pushDeviceToken } from "@/drizzle/schema/push-schema";
import { and, eq } from "drizzle-orm";

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
