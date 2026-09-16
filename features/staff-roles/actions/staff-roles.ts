"use server"

import { requireActionRole } from "@/lib/action-guard"
import { setStaffRole, clearStaffRole } from "@/features/staff-roles/db/staff-roles"
import { saveStaffRoleSchema } from "@/features/staff-roles/schemas/staff-roles"
import { db } from "@/drizzle/db"
import { user as userTable } from "@/drizzle/schema/auth-schema"
import { eq } from "drizzle-orm"

/**
 * Admin-only (deliberately stricter than case reassignment, which a supervisor can do):
 * deciding *who becomes* a staff-designated agent/moderator is an identity/HR action.
 */
export async function saveStaffRoleAction(
  userId: string,
  role: string | null,
  isSupervisor: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireActionRole((r) => r === "admin")
  if (!session) return { ok: false, error: "Unauthorized" }

  const parsed = saveStaffRoleSchema.safeParse({ userId, role, isSupervisor })
  if (!parsed.success) return { ok: false, error: "Invalid staff role data" }

  // Mirrors saveUserPermissionsAction's existing check: this designation only ever
  // applies to internal users.
  const [target] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, parsed.data.userId))
    .limit(1)
  if (!target || target.role !== "internal") {
    return { ok: false, error: "Target user is not an internal user" }
  }

  if (parsed.data.role === null) {
    await clearStaffRole(parsed.data.userId)
    return { ok: true }
  }

  // Keeps the supervisor flag's meaning singular: only an escrow_agent can be a supervisor.
  if (parsed.data.isSupervisor && parsed.data.role !== "escrow_agent") {
    return { ok: false, error: "Only an escrow agent can be a supervisor" }
  }

  await setStaffRole(parsed.data.userId, parsed.data.role, parsed.data.isSupervisor)
  return { ok: true }
}
