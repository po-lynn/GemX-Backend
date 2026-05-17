import { NextRequest, connection } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { processAutoRenewals } from "@/features/points/db/points"

/**
 * POST /api/cron/renew-premium-dealers
 * Processes expired premium dealer subscriptions: renews auto-renew ones,
 * marks the rest as expired. Called daily by Vercel Cron.
 * Secured by CRON_SECRET environment variable.
 */
export async function POST(request: NextRequest) {
  await connection()

  const secret = process.env.CRON_SECRET
  if (!secret) return jsonError("Cron not configured", 500)

  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) return jsonError("Unauthorized", 401)

  try {
    const result = await processAutoRenewals()
    console.log("[cron] renew-premium-dealers:", result)
    return jsonUncached(result)
  } catch (e) {
    console.error("[cron] renew-premium-dealers error:", e)
    return jsonError("Internal server error", 500)
  }
}
