import { connection, NextRequest } from "next/server"
import { jsonUncached } from "@/lib/api"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import {
  getSurpriseBonusJobStatusCounts,
  listSurpriseBonusJobs,
} from "@/features/points/db/surprise-bonus"

/**
 * GET /api/admin/points/surprise-bonus/jobs
 * Background job queue status for the admin Surprise Bonus panel: status
 * counts (including stale `processing` jobs) and the most recent jobs.
 */
export async function GET(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.CREDIT_TRANSACTIONS)
  if ("error" in gate) return gate.error

  const [counts, jobs] = await Promise.all([
    getSurpriseBonusJobStatusCounts(),
    listSurpriseBonusJobs(100),
  ])

  return jsonUncached({
    counts,
    jobs: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      isStale: j.isStale,
      attempts: j.attempts,
      maxAttempts: j.maxAttempts,
      availableAt: j.availableAt.toISOString(),
      lockedAt: j.lockedAt?.toISOString() ?? null,
      lockedBy: j.lockedBy,
      lastError: j.lastError,
      createdAt: j.createdAt.toISOString(),
      completedAt: j.completedAt?.toISOString() ?? null,
      campaignId: j.campaignId,
      campaignName: j.campaignName,
    })),
  })
}
