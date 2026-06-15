import { unstable_cache, revalidateTag } from "next/cache"
import { sql, eq } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { internalPermission } from "@/drizzle/schema/rbac-schema"

function permCacheTag(userId: string) {
  return `internal-permissions-${userId}`
}

export async function getUserPermissions(userId: string): Promise<Record<string, boolean>> {
  return unstable_cache(
    async () => {
      const rows = await db.select().from(internalPermission)
        .where(eq(internalPermission.userId, userId))
      return Object.fromEntries(rows.map((r) => [r.featureKey, r.canAccess]))
    },
    [permCacheTag(userId)],
    { tags: [permCacheTag(userId)] }
  )()
}

export async function checkInternalAccess(userId: string, featureKey: string): Promise<boolean> {
  const perms = await getUserPermissions(userId)
  return perms[featureKey] ?? false
}

export async function setUserPermissions(
  userId: string,
  perms: Record<string, boolean>
): Promise<void> {
  const rows = Object.entries(perms).map(([featureKey, canAccess]) => ({
    userId,
    featureKey,
    canAccess,
  }))
  if (rows.length === 0) {
    revalidateTag(permCacheTag(userId), "default")
    return
  }
  await db
    .insert(internalPermission)
    .values(rows)
    .onConflictDoUpdate({
      target: [internalPermission.userId, internalPermission.featureKey],
      set: { canAccess: sql`excluded.can_access` },
    })
  revalidateTag(permCacheTag(userId), "default")
}
