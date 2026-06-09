import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { jsonError, jsonUncached } from "@/lib/api"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { approvePointPurchaseRequest } from "@/features/points/db/points"

const bodySchema = z.object({
  adminNote: z.string().max(500).optional(),
})

type RouteParams = { params: Promise<{ id: string }> }

/**
 * POST /api/admin/point-purchase-requests/[id]/approve
 * Approve a pending purchase request and credit the points to the user.
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

    const result = await approvePointPurchaseRequest(id, session.user.id, parsed.data.adminNote)
    if (!result.success) {
      return jsonError(result.reason === "not_found" ? "Request not found" : "Request is not pending", result.reason === "not_found" ? 404 : 400)
    }

    return jsonUncached({
      success: true,
      requestId: id,
      pointsAdded: result.pointsAdded,
      userBalance: result.updatedPoints,
    })
  } catch (e) {
    console.error("POST /api/admin/point-purchase-requests/[id]/approve:", e)
    return jsonError("Failed to approve request", 500)
  }
}
