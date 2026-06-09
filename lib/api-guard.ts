import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { checkSupervisorAccess } from "@/features/rbac/db/permissions"
import { jsonError } from "@/lib/api"

type GuardResult =
  | { session: { user: { role: string; id: string; [key: string]: unknown } }; error?: never }
  | { error: Response; session?: never }

export async function requireAdminOrFeature(
  request: NextRequest,
  featureKey: string
): Promise<GuardResult> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { error: jsonError("Unauthorized", 401) }
  if (session.user.role === "admin") return { session }
  if (session.user.role === "supervisor" && await checkSupervisorAccess(featureKey)) {
    return { session }
  }
  return { error: jsonError("Forbidden", 403) }
}
