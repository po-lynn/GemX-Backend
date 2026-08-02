import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { jsonError } from "@/lib/api"

type GuardResult =
  | { session: { user: { role: string; id: string; [key: string]: unknown } } }
  | { error: Response }

/** Allows admin or internal role (no per-feature RBAC check). */
export async function requireAdminRole(request: NextRequest): Promise<GuardResult> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { error: jsonError("Unauthorized", 401) }
  if (session.user.role !== "admin" && session.user.role !== "internal") {
    return { error: jsonError("Forbidden", 403) }
  }
  return { session }
}

/** Allows role === "admin" only (no internal/RBAC fallback) — for admin-oversight-only endpoints. */
export async function requireStrictAdmin(request: NextRequest): Promise<GuardResult> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { error: jsonError("Unauthorized", 401) }
  if (session.user.role !== "admin") return { error: jsonError("Forbidden", 403) }
  return { session }
}

/** Allows portal role only. */
export async function requirePortalRole(request: NextRequest): Promise<GuardResult> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { error: jsonError("Unauthorized", 401) }
  if (session.user.role !== "portal") return { error: jsonError("Forbidden", 403) }
  return { session }
}

export async function requireAdminOrFeature(
  request: NextRequest,
  featureKey: string
): Promise<GuardResult> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { error: jsonError("Unauthorized", 401) }
  if (session.user.role === "admin") return { session }
  if (session.user.role === "internal") {
    const { checkInternalAccess } = await import("@/features/rbac/db/permissions")
    if (await checkInternalAccess(session.user.id, featureKey)) {
      return { session }
    }
  }
  return { error: jsonError("Forbidden", 403) }
}

/** Same as requireAdminOrFeature, but internal role is allowed if it holds ANY of the given keys. */
export async function requireAdminOrAnyFeature(
  request: NextRequest,
  featureKeys: string[]
): Promise<GuardResult> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { error: jsonError("Unauthorized", 401) }
  if (session.user.role === "admin") return { session }
  if (session.user.role === "internal") {
    const { checkInternalAccess } = await import("@/features/rbac/db/permissions")
    const results = await Promise.all(featureKeys.map((key) => checkInternalAccess(session.user.id, key)))
    if (results.some(Boolean)) return { session }
  }
  return { error: jsonError("Forbidden", 403) }
}
