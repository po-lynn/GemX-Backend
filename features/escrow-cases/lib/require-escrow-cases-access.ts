import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { checkInternalAccess } from "@/features/rbac/db/permissions"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"

/**
 * Page-level gate for the escrow agent inbox: "can this internal user open the page at
 * all." Mirrors features/messages/lib/require-messages-access.ts. Which specific cases
 * they see (own vs. every agent's) is a separate question answered by the list query and
 * features/escrow-cases/lib/case-access.ts's row-level check, not by this gate.
 *
 * Also admits CHAT_MODERATION alone (previously it didn't — a pure chat moderator with
 * no ESCROW_CASES grant could pass every row-level check in case-access.ts and still
 * never reach this page at all, since GET /api/admin/escrow-cases/[id]/messages already
 * supports a "moderation" scope). Fixed alongside the list endpoint's same gap.
 */
export async function requireEscrowCasesAccess() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")
  if (session.user.role === "admin") return session
  if (session.user.role === "internal") {
    if (await checkInternalAccess(session.user.id, FEATURE_KEYS.ESCROW_CASES)) return session
    if (await checkInternalAccess(session.user.id, FEATURE_KEYS.CHAT_MODERATION)) return session
  }
  redirect("/admin")
}
