import { NextRequest, connection } from "next/server"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached } from "@/lib/api"
import { getUserPointBalance } from "@/features/points/db/points"

/**
 * GET /api/mobile/points/balance
 * Returns the authenticated user's point balance breakdown.
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const balance = await getUserPointBalance(session.user.id)
    return jsonUncached(balance)
  } catch (e) {
    console.error("GET /api/mobile/points/balance:", e)
    return jsonError("Failed to load balance", 500)
  }
}
