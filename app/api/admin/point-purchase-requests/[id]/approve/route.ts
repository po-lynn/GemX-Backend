import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached } from "@/lib/api"
import { canAdminManageUsers } from "@/features/users/permissions/users"
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
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)
    if (!canAdminManageUsers(session.user.role)) return jsonError("Forbidden", 403)

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
