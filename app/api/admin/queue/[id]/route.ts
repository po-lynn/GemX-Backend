import { connection, NextRequest } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { deleteJob, getJob } from "@/lib/queue/queue"
import { getQueueJobDefinition } from "@/lib/queue/registry"
import "@/lib/queue/registrations"

/**
 * GET /api/admin/queue/[id]
 * Single-job lookup backing the job detail drawer (client-side fetch, so the
 * queue detail page underneath doesn't unmount when a job is opened).
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.QUEUE_MANAGEMENT)
  if ("error" in gate) return gate.error

  const { id } = await context.params
  const job = await getJob(id)
  if (!job) return jsonError("Job not found", 404)

  const definition = getQueueJobDefinition(job.type)
  const descriptions = definition?.describeJobs ? await definition.describeJobs([job]) : new Map<string, string>()

  return jsonUncached({
    id: job.id,
    type: job.type,
    label: definition?.label ?? job.type,
    status: job.status,
    isStale: job.isStale,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    availableAt: job.availableAt.toISOString(),
    lockedAt: job.lockedAt?.toISOString() ?? null,
    lockedBy: job.lockedBy,
    lastError: job.lastError,
    result: job.result,
    payload: job.payload,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
    description: descriptions.get(job.id) ?? null,
  })
}

/**
 * DELETE /api/admin/queue/[id]
 * Removes one job's queue-tracking row — only permitted for a job already
 * `completed` or `failed`. Whatever the job produced (a campaign record,
 * ledger entries, etc.) is untouched; this only tidies up the queue view.
 */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.QUEUE_MANAGEMENT)
  if ("error" in gate) return gate.error

  const { id } = await context.params
  const deleted = await deleteJob(id)
  if (!deleted) return jsonError("Job not found, or not completed/failed", 404)

  return jsonUncached({ success: true, id })
}
