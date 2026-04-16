import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached } from "@/lib/api"
import { canAdminManageUsers } from "@/features/users/permissions/users"
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
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)
    if (!canAdminManageUsers(session.user.role)) return jsonError("Forbidden", 403)

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
