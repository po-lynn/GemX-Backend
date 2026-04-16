import { NextRequest, connection } from "next/server"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached } from "@/lib/api"
import { getUserPremiumDealerStatus } from "@/features/points/db/points"

/**
 * GET /api/mobile/premium-dealers/status
 * Returns the authenticated user's active premium dealer status.
 * If no active package or status has expired, returns { active: false }.
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const status = await getUserPremiumDealerStatus(session.user.id)
    if (!status) return jsonUncached({ active: false })

    return jsonUncached({
      active: true,
      packageName: status.packageName,
      expiresAt: status.expiresAt.toISOString(),
    })
  } catch (e) {
    console.error("GET /api/mobile/premium-dealers/status:", e)
    return jsonError("Failed to load premium dealer status", 500)
  }
}
