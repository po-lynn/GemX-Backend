import { connection, NextRequest } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { deleteJob } from "@/lib/queue/queue"

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
