import { NextRequest, connection } from "next/server"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached } from "@/lib/api"
import { getMyPremiumStatus } from "@/features/points/db/points"

/**
 * GET /api/mobile/premium-dealers/status
 * Returns the authenticated user's point balance, active premium status,
 * expiry, days remaining, and autoRenew flag.
 * Used by the "Become Premium" screen to bootstrap the full page state.
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const status = await getMyPremiumStatus(session.user.id)
    return jsonUncached(status)
  } catch (e) {
    console.error("GET /api/mobile/premium-dealers/status:", e)
    return jsonError("Failed to load premium dealer status", 500)
  }
}
