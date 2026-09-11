import { connection, NextRequest } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getJobStatusCounts, listJobs } from "@/lib/queue/queue"
import { getQueueJobDefinition, listRegisteredJobTypes } from "@/lib/queue/registry"
import "@/lib/queue/registrations"

/**
 * GET /api/admin/queue
 * GET /api/admin/queue?type=<type>
 * Without `type`: status counts for every registered job type.
 * With `type`: that type's status counts plus its most recent jobs,
 * enriched via that type's optional describeJobs hook.
 */
export async function GET(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.QUEUE_MANAGEMENT)
  if ("error" in gate) return gate.error

  const type = new URL(request.url).searchParams.get("type")
  const types = listRegisteredJobTypes()

  if (!type) {
    const counts = await Promise.all(
      types.map(async (t) => ({ ...t, counts: await getJobStatusCounts(t.type) })),
    )
    return jsonUncached({ types: counts })
  }

  const definition = getQueueJobDefinition(type)
  if (!definition) return jsonError(`Unknown job type: ${type}`, 404)

  const [counts, jobs] = await Promise.all([getJobStatusCounts(type), listJobs(type, 100)])
  const descriptions = definition.describeJobs ? await definition.describeJobs(jobs) : new Map<string, string>()

  return jsonUncached({
    types,
    selectedType: type,
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
      result: j.result,
      createdAt: j.createdAt.toISOString(),
      completedAt: j.completedAt?.toISOString() ?? null,
      description: descriptions.get(j.id) ?? null,
    })),
  })
}
