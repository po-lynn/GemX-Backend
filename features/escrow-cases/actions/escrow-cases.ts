"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { checkInternalAccess } from "@/features/rbac/db/permissions"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { searchUsersForPicker, type UserPickerOption } from "@/features/users/db/users"
import { searchProductsForAdmin, type AdminSearchProduct } from "@/features/products/db/products"
import { getUsersByStaffRole } from "@/features/staff-roles/db/staff-roles"

/** Server-action equivalent of requireEscrowCasesAccess (lib/action-guard.ts's
 *  requireActionRole doesn't know about feature keys, only a role predicate). */
async function requireEscrowCasesActionAccess() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  if (session.user.role === "admin") return session
  if (session.user.role === "internal" && (await checkInternalAccess(session.user.id, FEATURE_KEYS.ESCROW_CASES))) {
    return session
  }
  return null
}

export async function searchUsersForEscrowCaseAction(query: string): Promise<UserPickerOption[]> {
  const session = await requireEscrowCasesActionAccess()
  if (!session) return []
  return searchUsersForPicker(query, 8)
}

export async function searchListingsForEscrowCaseAction(query: string): Promise<AdminSearchProduct[]> {
  const session = await requireEscrowCasesActionAccess()
  if (!session) return []
  return searchProductsForAdmin(query, 8)
}

export async function getEscrowAgentOptionsAction(): Promise<
  Array<{ userId: string; name: string; email: string; isSupervisor: boolean }>
> {
  const session = await requireEscrowCasesActionAccess()
  if (!session) return []
  return getUsersByStaffRole("escrow_agent")
}
