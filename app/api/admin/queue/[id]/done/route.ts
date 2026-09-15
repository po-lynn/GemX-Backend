import { connection, NextRequest } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { setJobDone } from "@/lib/queue/queue"

/**
 * POST /api/admin/queue/[id]/done
 * Manual per-job override: force-completes a job without running its
 * handler, for a job an admin has verified is effectively resolved by other
 * means. Like the normal completion path, this deletes the job's tracking
 * row — no record of which admin forced it is kept, same as a manual delete.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.QUEUE_MANAGEMENT)
  if ("error" in gate) return gate.error

  const { id } = await context.params
  const marked = await setJobDone(id)
  if (!marked) return jsonError("Job not found", 404)

  return jsonUncached({ success: true, id })
}
