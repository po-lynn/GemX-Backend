import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { checkSupervisorAccess } from "@/features/rbac/db/permissions"

export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")
  if (session.user.role !== "admin") redirect("/admin")
  return session
}

export async function requireFeatureAccess(featureKey: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")
  if (session.user.role === "admin") return session
  if (session.user.role === "supervisor") {
    if (await checkSupervisorAccess(session.user.id, featureKey)) return session
  }
  redirect("/admin")
}
