"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
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
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return { ok: false, error: "Unauthorized" }
  }
  const parsed = saveUserPermissionsSchema.safeParse({ userId, permissions })
  if (!parsed.success) return { ok: false, error: "Invalid permissions data" }
  await setUserPermissions(parsed.data.userId, parsed.data.permissions)
  return { ok: true }
}
