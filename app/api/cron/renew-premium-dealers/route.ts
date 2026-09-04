import { NextRequest, connection } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireCronSecret } from "@/lib/api-guard"
import { processAutoRenewals } from "@/features/points/db/points"

/**
 * POST /api/cron/renew-premium-dealers
 * Processes expired premium dealer subscriptions: renews auto-renew ones,
 * marks the rest as expired. Called daily by Vercel Cron.
 * Secured by CRON_SECRET environment variable.
 */
export async function POST(request: NextRequest) {
  await connection()

  const authError = requireCronSecret(request)
  if (authError) return authError

  try {
    const result = await processAutoRenewals()
    console.log("[cron] renew-premium-dealers:", result)
    return jsonUncached(result)
  } catch (e) {
    console.error("[cron] renew-premium-dealers error:", e)
    return jsonError("Internal server error", 500)
  }
}
