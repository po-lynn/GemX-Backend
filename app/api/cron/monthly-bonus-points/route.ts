import { NextRequest, connection } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { grantDueMonthlyBonusPoints } from "@/features/points/db/monthly-bonus"

/**
 * POST /api/cron/monthly-bonus-points
 * Grants due monthly-program bonuses (every 30 days from Distribution Start Date).
 * Runs daily so 30-day boundaries are not missed. Secured by CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  await connection()

  const secret = process.env.CRON_SECRET
  if (!secret) return jsonError("Cron not configured", 500)

  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) return jsonError("Unauthorized", 401)

  try {
    const result = await grantDueMonthlyBonusPoints()
    console.log("[cron] monthly-bonus-points:", result)
    return jsonUncached(result)
  } catch (e) {
    console.error("[cron] monthly-bonus-points error:", e)
    return jsonError("Internal server error", 500)
  }
}
