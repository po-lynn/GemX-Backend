import { connection, NextRequest } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { requeueJob } from "@/lib/queue/queue"

/**
 * POST /api/admin/queue/[id]/requeue
 * Manual per-job override: forces one job back to `pending` for reprocessing
 * on the next drain pass. Allowed from any status except `processing` with
 * a still-fresh lock — see lib/queue/queue.ts's requeueJob for why (a live
 * worker may genuinely still be executing it).
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.QUEUE_MANAGEMENT)
  if ("error" in gate) return gate.error

  const { id } = await context.params
  const requeued = await requeueJob(id)
  if (!requeued) return jsonError("Job not found, or still actively processing", 404)

  return jsonUncached({ success: true, id })
}
