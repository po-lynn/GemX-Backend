import { connection, NextRequest } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { drainSurpriseBonusJobs } from "@/features/points/services/process-surprise-bonus-jobs"

/** Room for several 100-user batches in one manual retry. */
export const maxDuration = 60

/** Cap per invocation so a single click cannot run forever. */
const MAX_BATCHES_PER_RUN = 50

/**
 * POST /api/admin/points/surprise-bonus/jobs/retry
 * Manual "Retry stuck jobs" button: runs one drain pass over the queue —
 * reclaims anything stranded `processing` (>3 min stale, migration 0087) and
 * finishes any due `pending` batches — without creating a new campaign.
 */
export async function POST(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.CREDIT_TRANSACTIONS)
  if ("error" in gate) return gate.error

  try {
    const result = await drainSurpriseBonusJobs({ maxBatches: MAX_BATCHES_PER_RUN })
    return jsonUncached({
      success: true,
      batches: result.batches,
      last: result.last ?? null,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[surprise-bonus] manual retry drain failed:", e)
    return jsonError(`Retry failed: ${message}`, 500)
  }
}
