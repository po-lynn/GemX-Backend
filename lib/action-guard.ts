import { headers } from "next/headers"
import { auth } from "@/lib/auth"

/**
 * Role guard for server actions (cookie session via next/headers).
 * Returns the session when the user's role passes `can`, otherwise null —
 * callers return their own `{ error: "Unauthorized" }` shape.
 */
export async function requireActionRole(can: (role: string) => boolean) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !can(session.user.role)) return null
  return session
}
