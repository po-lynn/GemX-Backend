import { NextRequest, connection } from "next/server"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached } from "@/lib/api"
import { getEscrowServiceChatUser } from "@/features/escrow-service-settings/db/escrow-service-settings"

/**
 * GET /api/mobile/escrow-chat-user
 * Returns the GemX user account designated for escrow-service in-app chat
 * (`escrow_service_setting.user_id`, latest admin-configured row).
 */
export async function GET(_request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: _request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const { configured, user, serviceFee, serviceOverview } = await getEscrowServiceChatUser()
    return jsonUncached({ success: true, configured, user, serviceFee, serviceOverview })
  } catch (e) {
    console.error("GET /api/mobile/escrow-chat-user:", e)
    return jsonError("Failed to load escrow chat user", 500)
  }
}
