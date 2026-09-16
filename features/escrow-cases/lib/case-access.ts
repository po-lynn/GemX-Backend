import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { jsonError } from "@/lib/api"
import { getStaffRole } from "@/features/staff-roles/db/staff-roles"
import { checkInternalAccess } from "@/features/rbac/db/permissions"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getEscrowCaseById, type EscrowCaseRow } from "@/features/escrow-cases/db/escrow-cases"

export type EscrowCaseScope = "admin" | "supervisor" | "own" | "moderation"

export type EscrowCaseAccess =
  | { ok: true; session: { user: { id: string; role: string } }; scope: EscrowCaseScope; case: EscrowCaseRow }
  | { ok: false; error: Response }

/**
 * Row-level authorization for a single escrow case's thread. Feature-local (like
 * require-messages-access.ts), not folded into lib/api-guard.ts, because it also
 * needs a case-row DB lookup the generic guards don't do.
 *
 * - admin: full access to any case.
 * - supervisor (staff_role.isSupervisor = true, role = escrow_agent): any case.
 * - plain escrow_agent: only a case assigned to them, and only with the
 *   ESCROW_CASES feature key granted.
 * - moderator (with the CHAT_MODERATION feature key): any case, read-only
 *   ("moderation" scope — see requireEscrowThreadWriteAccess below).
 */
export async function requireEscrowCaseAccess(request: NextRequest, caseId: string): Promise<EscrowCaseAccess> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { ok: false, error: jsonError("Unauthorized", 401) }

  const escrowCase = await getEscrowCaseById(caseId)
  if (!escrowCase) return { ok: false, error: jsonError("Not found", 404) }

  if (session.user.role === "admin") {
    return { ok: true, session, scope: "admin", case: escrowCase }
  }

  if (session.user.role !== "internal") {
    return { ok: false, error: jsonError("Forbidden", 403) }
  }

  const staffRole = await getStaffRole(session.user.id)

  if (staffRole?.role === "escrow_agent") {
    if (staffRole.isSupervisor) {
      return { ok: true, session, scope: "supervisor", case: escrowCase }
    }
    const isOwnCase =
      escrowCase.assignedAgentId === session.user.id &&
      (await checkInternalAccess(session.user.id, FEATURE_KEYS.ESCROW_CASES))
    if (isOwnCase) return { ok: true, session, scope: "own", case: escrowCase }
    return { ok: false, error: jsonError("Forbidden", 403) }
  }

  if (staffRole?.role === "moderator" && (await checkInternalAccess(session.user.id, FEATURE_KEYS.CHAT_MODERATION))) {
    return { ok: true, session, scope: "moderation", case: escrowCase }
  }

  return { ok: false, error: jsonError("Forbidden", 403) }
}

/**
 * Same check, but rejects the read-only "moderation" scope: moderators get oversight,
 * never escrow-thread participation (item 2 of the brief's Scope section). The
 * operator-exception post (a supervisor/admin posting into a case they aren't
 * personally assigned to) is only reachable at scope "supervisor"/"admin", via this
 * same check — and only ever takes a caseId, which doesn't exist for a private
 * buyer<->seller thread, so that exception can't leak into ordinary 1:1 chat.
 */
export async function requireEscrowThreadWriteAccess(
  request: NextRequest,
  caseId: string
): Promise<EscrowCaseAccess> {
  const access = await requireEscrowCaseAccess(request, caseId)
  if (!access.ok) return access
  if (access.scope === "moderation") return { ok: false, error: jsonError("Forbidden", 403) }
  return access
}
