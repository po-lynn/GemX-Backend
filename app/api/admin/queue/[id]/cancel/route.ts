import { connection, NextRequest } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { cancelJob } from "@/lib/queue/queue"

/**
 * POST /api/admin/queue/[id]/cancel
 * Manual per-job override: marks a job `cancelled` (terminal) so it stops
 * being retried. Blocked on an already-`completed` job — see
 * lib/queue/queue.ts's cancelJob — which this reports the same way as a
 * missing id (404), mirroring DELETE /api/admin/queue/[id]'s convention of
 * combining "not found" and "wrong state" into one message.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.QUEUE_MANAGEMENT)
  if ("error" in gate) return gate.error

  const { id } = await context.params
  const cancelled = await cancelJob(id, `Cancelled by admin (${gate.session.user.id})`)
  if (!cancelled) return jsonError("Job not found, or already completed", 404)

  return jsonUncached({ success: true, id })
}
