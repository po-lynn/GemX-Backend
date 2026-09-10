import { connection, NextRequest } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { drainJobs } from "@/lib/queue/drain"
import { getQueueJobDefinition } from "@/lib/queue/registry"
import "@/lib/queue/registrations"

/** Room for several batches in one manual retry. */
export const maxDuration = 60

/** Cap per invocation so a single click cannot run forever. */
const MAX_BATCHES_PER_RUN = 50

/**
 * POST /api/admin/queue/retry
 * Body: { type: string }
 * Manual "Retry stuck jobs" action: runs one drain pass for the given type —
 * reclaims anything stranded `processing` (per claim_background_job's stale
 * window) and finishes any due `pending` jobs.
 */
export async function POST(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.QUEUE_MANAGEMENT)
  if ("error" in gate) return gate.error

  const body = (await request.json().catch(() => null)) as { type?: string } | null
  const type = body?.type
  if (!type) return jsonError("type is required", 400)

  const definition = getQueueJobDefinition(type)
  if (!definition) return jsonError(`Unknown job type: ${type}`, 404)

  try {
    const result = await drainJobs(type, definition.handler, { maxBatches: MAX_BATCHES_PER_RUN })
    return jsonUncached({ success: true, batches: result.batches })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[queue:${type}] manual retry drain failed:`, e)
    return jsonError(`Retry failed: ${message}`, 500)
  }
}
