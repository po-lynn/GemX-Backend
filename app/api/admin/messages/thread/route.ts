import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { requireAdminOrAnyFeature } from "@/lib/api-guard"
import { jsonError, jsonUncached, parseQuery } from "@/lib/api"
import { getConversationMessagesForAdmin } from "@/features/chat/db/admin-all-conversations"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { recordThreadViewed } from "@/features/chat-moderation/db/audit-log"
import { pairKey } from "@/features/messages/db/triage"

const querySchema = z.object({
  userA: z.string().trim().min(1),
  userB: z.string().trim().min(1),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(200),
})

/**
 * GET /api/admin/messages/thread?userA=<id>&userB=<id>&page=1&limit=200
 * Backs the Messages triage inbox's reading pane. Unlike
 * /api/admin/chat/all-conversations/messages (admin-only oversight tool),
 * this accepts admin OR internal staff holding the messages/chat_dashboard
 * permission — matching requireMessagesAccess()'s page-level guard. Also accepts
 * CHAT_MODERATION alone (a pure chat moderator, who may hold neither MESSAGES nor
 * CHAT_DASHBOARD) — same "moderators need to reach oversight UI" fix as escrow
 * cases' page gate.
 *
 * Every successful read here is logged as `thread_viewed` (escrow_chat_audit_log,
 * targetType "flat_thread") — this route is never how a participant reads their own
 * conversation (that's /api/chat/messages on mobile/web), so a request reaching it is
 * always staff viewing someone else's thread, i.e. exactly the brief's "viewing is
 * itself audit-logged; the participants are not notified" requirement. This route
 * already never notifies anyone, so no separate change was needed for that half.
 */
export async function GET(request: NextRequest) {
  await connection()
  const guard = await requireAdminOrAnyFeature(request, [
    FEATURE_KEYS.MESSAGES,
    FEATURE_KEYS.CHAT_DASHBOARD,
    FEATURE_KEYS.CHAT_MODERATION,
  ])
  if ("error" in guard) return guard.error

  try {
    const { userA, userB, page, limit } = parseQuery(new URL(request.url).searchParams, querySchema)
    if (userA === userB) return jsonError("userA and userB must differ", 400)

    const { messages, total } = await getConversationMessagesForAdmin(userA, userB, page, limit)

    await recordThreadViewed({
      actorId: guard.session.user.id,
      targetType: "flat_thread",
      targetId: pairKey(userA, userB),
    })

    return jsonUncached({ success: true, messages, page, limit, total })
  } catch (error) {
    console.error("GET /api/admin/messages/thread:", error)
    return jsonError("Failed to load messages", 500)
  }
}
