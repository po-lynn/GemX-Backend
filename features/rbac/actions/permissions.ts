"use server"

import { requireActionRole } from "@/lib/action-guard"
import { setUserPermissions } from "@/features/rbac/db/permissions"
import { updatePermissionsSchema } from "@/features/rbac/schemas/permissions"
import { z } from "zod"
import { db } from "@/drizzle/db"
import { user as userTable } from "@/drizzle/schema/auth-schema"
import { eq } from "drizzle-orm"

const saveUserPermissionsSchema = updatePermissionsSchema.extend({
  userId: z.string().min(1),
})

export async function saveUserPermissionsAction(
  userId: string,
  permissions: Record<string, boolean>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireActionRole((role) => role === "admin" || role === "internal")
  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }
  const parsed = saveUserPermissionsSchema.safeParse({ userId, permissions })
  if (!parsed.success) return { ok: false, error: "Invalid permissions data" }

  // internal users cannot elevate their own permissions
  if (session.user.role === "internal" && parsed.data.userId === session.user.id) {
    return { ok: false, error: "Cannot modify your own permissions" }
  }

  // permissions only apply to internal users — reject writes targeting other roles
  const [target] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, parsed.data.userId))
    .limit(1)
  if (!target || target.role !== "internal") {
    return { ok: false, error: "Target user is not an internal user" }
  }

  await setUserPermissions(parsed.data.userId, parsed.data.permissions)
  return { ok: true }
}
