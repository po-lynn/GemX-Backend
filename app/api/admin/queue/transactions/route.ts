import { connection, NextRequest } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getQueueJobDefinition } from "@/lib/queue/registry"
import "@/lib/queue/registrations"

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500

/**
 * GET /api/admin/queue/transactions?type=<type>&limit=<n>
 * Flat, per-unit-of-work rows for a job type's "Transactions" view (the
 * Odoo-style flat job list) — only populated for types whose registration
 * provides a `listTransactions` hook; otherwise `supported: false` so the
 * client can fall back to the batch-level "Jobs" view.
 */
export async function GET(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.QUEUE_MANAGEMENT)
  if ("error" in gate) return gate.error

  const url = new URL(request.url)
  const type = url.searchParams.get("type")
  if (!type) return jsonError("type is required", 400)

  const definition = getQueueJobDefinition(type)
  if (!definition) return jsonError(`Unknown job type: ${type}`, 404)

  if (!definition.listTransactions) {
    return jsonUncached({ supported: false, transactions: [] })
  }

  const limitParam = Number(url.searchParams.get("limit"))
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : DEFAULT_LIMIT

  const transactions = await definition.listTransactions(limit)

  return jsonUncached({
    supported: true,
    transactions: transactions.map((t) => ({
      id: t.id,
      source: t.source,
      description: t.description,
      state: t.state,
      createdAt: t.createdAt.toISOString(),
      completedAt: t.completedAt?.toISOString() ?? null,
      reference: t.reference,
      detail: t.detail,
    })),
  })
}
