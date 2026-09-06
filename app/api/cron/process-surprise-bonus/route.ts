import { NextRequest, connection } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireCronSecret } from "@/lib/api-guard"
import { drainSurpriseBonusJobs } from "@/features/points/services/process-surprise-bonus-jobs"

/** Enough time for several 100-user batches on Vercel Pro. */
export const maxDuration = 60

/** Cap per invocation so a single cron tick cannot run forever. */
const MAX_BATCHES_PER_RUN = 50

/**
 * GET|POST /api/cron/process-surprise-bonus
 * Drains pending `surprise_bonus_batch` jobs (All Users Top-up).
 * Scheduled every minute via vercel.json so production campaigns leave `processing`.
 * Secured by CRON_SECRET (Vercel Cron sends Bearer automatically when set).
 */
async function handle(request: NextRequest) {
  await connection()

  const authError = requireCronSecret(request)
  if (authError) return authError

  try {
    const result = await drainSurpriseBonusJobs({ maxBatches: MAX_BATCHES_PER_RUN })
    console.log("[cron] process-surprise-bonus:", result)
    return jsonUncached({
      success: true,
      batches: result.batches,
      last: result.last ?? null,
    })
  } catch (e) {
    console.error("[cron] process-surprise-bonus error:", e)
    return jsonError("Internal server error", 500)
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
