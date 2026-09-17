import { NextRequest, connection } from "next/server"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { jsonError, jsonUncached } from "@/lib/api"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { listAuditLogForActor, listAuditLogForTarget, listRecentAuditLog } from "@/features/chat-moderation/db/audit-log"
import { escrowChatAuditTargetEnum, escrowChatAuditActionEnum } from "@/drizzle/schema/chat-moderation-schema"

/**
 * GET /api/admin/chat-moderation/audit-log — the per-thread/per-user audit trail
 * viewer's backend. Three modes, mutually exclusive:
 *   ?targetType=<t>&targetId=<id>  — one specific escrow case / user / report / message
 *   ?actorId=<id>                 — everything one staff member did
 *   (neither)                     — recent feed, optionally &actionType=<a>
 */
export async function GET(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.CHAT_MODERATION)
  if ("error" in gate) return gate.error

  try {
    const params = new URL(request.url).searchParams
    const targetType = params.get("targetType")
    const targetId = params.get("targetId")
    const actorId = params.get("actorId")
    const actionTypeParam = params.get("actionType")
    const actionType =
      actionTypeParam && (escrowChatAuditActionEnum.enumValues as string[]).includes(actionTypeParam)
        ? (actionTypeParam as (typeof escrowChatAuditActionEnum.enumValues)[number])
        : undefined

    if (targetType && targetId) {
      if (!(escrowChatAuditTargetEnum.enumValues as string[]).includes(targetType)) {
        return jsonError("Invalid targetType", 400)
      }
      const entries = await listAuditLogForTarget(targetType as (typeof escrowChatAuditTargetEnum.enumValues)[number], targetId)
      return jsonUncached({ success: true, entries })
    }

    if (actorId) {
      const entries = await listAuditLogForActor(actorId)
      return jsonUncached({ success: true, entries })
    }

    const entries = await listRecentAuditLog({ actionType })
    return jsonUncached({ success: true, entries })
  } catch (error) {
    console.error("GET /api/admin/chat-moderation/audit-log:", error)
    return jsonError("Failed to load audit log", 500)
  }
}
