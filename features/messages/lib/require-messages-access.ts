import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { checkInternalAccess } from "@/features/rbac/db/permissions"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"

// The Messages triage inbox absorbed /admin/chat-dashboard (see
// docs/technical/messages-triage.md). Internal staff could previously hold
// the chat_dashboard permission independently of messages, so this accepts
// either — nobody who has access today loses it. Scoped to this page rather
// than changing lib/admin-guard.ts's requireFeatureAccess, which ~35 other
// admin pages rely on with single-key semantics.
export async function requireMessagesAccess() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")
  if (session.user.role === "admin") return session
  if (session.user.role === "internal") {
    const [hasMessages, hasChatDashboard] = await Promise.all([
      checkInternalAccess(session.user.id, FEATURE_KEYS.MESSAGES),
      checkInternalAccess(session.user.id, FEATURE_KEYS.CHAT_DASHBOARD),
    ])
    if (hasMessages || hasChatDashboard) return session
  }
  redirect("/admin")
}
