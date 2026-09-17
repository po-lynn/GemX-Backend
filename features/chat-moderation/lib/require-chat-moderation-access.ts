import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { checkInternalAccess } from "@/features/rbac/db/permissions"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"

/** Page-level gate for the chat moderation dashboard (reports/restrictions/audit trail). Mirrors require-escrow-cases-access.ts. */
export async function requireChatModerationAccess() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")
  if (session.user.role === "admin") return session
  if (session.user.role === "internal") {
    if (await checkInternalAccess(session.user.id, FEATURE_KEYS.CHAT_MODERATION)) return session
  }
  redirect("/admin")
}
