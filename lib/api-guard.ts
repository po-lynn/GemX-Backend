import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { jsonError } from "@/lib/api"

type GuardResult =
  | { session: { user: { role: string; id: string; [key: string]: unknown } } }
  | { error: Response }

/** Allows admin or supervisor role (no per-feature RBAC check). */
export async function requireAdminRole(request: NextRequest): Promise<GuardResult> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { error: jsonError("Unauthorized", 401) }
  if (session.user.role !== "admin" && session.user.role !== "supervisor") {
    return { error: jsonError("Forbidden", 403) }
  }
  return { session }
}

export async function requireAdminOrFeature(
  request: NextRequest,
  featureKey: string
): Promise<GuardResult> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { error: jsonError("Unauthorized", 401) }
  if (session.user.role === "admin") return { session }
  if (session.user.role === "supervisor") {
    const { checkSupervisorAccess } = await import("@/features/rbac/db/permissions")
    if (await checkSupervisorAccess(session.user.id, featureKey)) {
      return { session }
    }
  }
  return { error: jsonError("Forbidden", 403) }
}
