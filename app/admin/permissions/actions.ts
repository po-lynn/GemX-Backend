"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { setSupervisorPermissions } from "@/features/rbac/db/permissions"
import { updatePermissionsSchema } from "@/features/rbac/schemas/permissions"

export async function savePermissions(
  permissions: Record<string, boolean>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return { ok: false, error: "Unauthorized" }
  }
  const parsed = updatePermissionsSchema.safeParse({ permissions })
  if (!parsed.success) return { ok: false, error: "Invalid permissions data" }
  await setSupervisorPermissions(parsed.data.permissions)
  return { ok: true }
}
