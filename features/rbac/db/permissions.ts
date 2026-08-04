import { cacheTag, revalidateTag } from "next/cache"
import { sql, eq } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { internalPermission } from "@/drizzle/schema/rbac-schema"
import { getIdTag } from "@/lib/dataCache"

function permCacheTag(userId: string) {
  return getIdTag("internalPermission", userId)
}

// "use cache" + cacheTag/revalidateTag(tag, "max"), matching every other
// cache in this codebase (see revalidateProductsCache) — this used to use
// unstable_cache, which doesn't participate in Next's cacheComponents tag
// invalidation the same way, so saved permission changes never took effect
// (the sidebar/access checks kept serving the first-ever cached snapshot).
export async function getUserPermissions(userId: string): Promise<Record<string, boolean>> {
  "use cache"
  cacheTag(permCacheTag(userId))
  const rows = await db.select().from(internalPermission)
    .where(eq(internalPermission.userId, userId))
  return Object.fromEntries(rows.map((r) => [r.featureKey, r.canAccess]))
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
    revalidateTag(permCacheTag(userId), "max")
    return
  }
  await db
    .insert(internalPermission)
    .values(rows)
    .onConflictDoUpdate({
      target: [internalPermission.userId, internalPermission.featureKey],
      set: { canAccess: sql`excluded.can_access` },
    })
  revalidateTag(permCacheTag(userId), "max")
}
