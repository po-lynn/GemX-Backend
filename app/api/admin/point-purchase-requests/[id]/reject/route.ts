import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { jsonError, jsonUncached } from "@/lib/api"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { rejectPointPurchaseRequest } from "@/features/points/db/points"

const bodySchema = z.object({
  adminNote: z.string().max(500).optional(),
})

type RouteParams = { params: Promise<{ id: string }> }

/**
 * POST /api/admin/point-purchase-requests/[id]/reject
 * Reject a pending purchase request. No points are credited.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  await connection()
  try {
    const gate = await requireAdminOrFeature(request, FEATURE_KEYS.CREDIT_PURCHASE_REQUESTS)
    if ("error" in gate) return gate.error
    const { session } = gate

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const result = await rejectPointPurchaseRequest(id, session.user.id, parsed.data.adminNote)
    if (!result.success) {
      return jsonError(result.reason === "not_found" ? "Request not found" : "Request is not pending", result.reason === "not_found" ? 404 : 400)
    }

    return jsonUncached({ success: true, requestId: id })
  } catch (e) {
    console.error("POST /api/admin/point-purchase-requests/[id]/reject:", e)
    return jsonError("Failed to reject request", 500)
  }
}
