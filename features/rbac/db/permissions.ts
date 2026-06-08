import { unstable_cache, revalidateTag } from "next/cache"
import { sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { supervisorPermission } from "@/drizzle/schema/rbac-schema"

const CACHE_TAG = "supervisor-permissions"

export const getSupervisorPermissions: () => Promise<Record<string, boolean>> =
  unstable_cache(
    async () => {
      const rows = await db.select().from(supervisorPermission)
      return Object.fromEntries(rows.map((r) => [r.featureKey, r.canAccess]))
    },
    [CACHE_TAG],
    { tags: [CACHE_TAG] }
  )

export async function checkSupervisorAccess(featureKey: string): Promise<boolean> {
  const perms = await getSupervisorPermissions()
  return perms[featureKey] ?? false
}

export async function setSupervisorPermissions(
  perms: Record<string, boolean>
): Promise<void> {
  const rows = Object.entries(perms).map(([featureKey, canAccess]) => ({
    featureKey,
    canAccess,
  }))
  if (rows.length === 0) {
    revalidateTag(CACHE_TAG)
    return
  }
  await db
    .insert(supervisorPermission)
    .values(rows)
    .onConflictDoUpdate({
      target: supervisorPermission.featureKey,
      set: { canAccess: sql`excluded.can_access` },
    })
  revalidateTag(CACHE_TAG)
}
