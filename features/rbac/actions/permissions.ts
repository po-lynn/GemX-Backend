"use server"

import { requireActionRole } from "@/lib/action-guard"
import { setUserPermissions } from "@/features/rbac/db/permissions"
import { updatePermissionsSchema } from "@/features/rbac/schemas/permissions"
import { z } from "zod"

const saveUserPermissionsSchema = updatePermissionsSchema.extend({
  userId: z.string().min(1),
})

export async function saveUserPermissionsAction(
  userId: string,
  permissions: Record<string, boolean>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireActionRole((role) => role === "admin")
  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }
  const parsed = saveUserPermissionsSchema.safeParse({ userId, permissions })
  if (!parsed.success) return { ok: false, error: "Invalid permissions data" }
  await setUserPermissions(parsed.data.userId, parsed.data.permissions)
  return { ok: true }
}
