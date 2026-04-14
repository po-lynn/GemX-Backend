import type { UserRole } from "@/drizzle/schema"

/** Returns true for roles that may manage escrow service requests (view list + update status). */
export function canManageEscrowRequests(role: UserRole | string | undefined): boolean {
  return role === "admin" || role === "escrow"
}
