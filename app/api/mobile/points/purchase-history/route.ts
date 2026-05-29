import { NextRequest, connection } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"
import { pointPurchaseRequest } from "@/drizzle/schema/points-schema"
import { and, desc, eq } from "drizzle-orm"
import { jsonError, jsonUncached } from "@/lib/api"
import { serializePointPurchaseRequest } from "@/features/points/api/purchase-request-response"

/**
 * GET /api/mobile/points/purchase-history
 * Returns the authenticated user's approved credit point purchase requests (completed top-ups).
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const rows = await db
      .select({
        id: pointPurchaseRequest.id,
        packageName: pointPurchaseRequest.packageName,
        paymentMethod: pointPurchaseRequest.paymentMethod,
        points: pointPurchaseRequest.points,
        price: pointPurchaseRequest.price,
        currency: pointPurchaseRequest.currency,
        status: pointPurchaseRequest.status,
        transferredAmount: pointPurchaseRequest.transferredAmount,
        transferredName: pointPurchaseRequest.transferredName,
        transactionReference: pointPurchaseRequest.transactionReference,
        transferNote: pointPurchaseRequest.transferNote,
        adminNote: pointPurchaseRequest.adminNote,
        createdAt: pointPurchaseRequest.createdAt,
        reviewedAt: pointPurchaseRequest.reviewedAt,
      })
      .from(pointPurchaseRequest)
      .where(
        and(
          eq(pointPurchaseRequest.userId, session.user.id),
          eq(pointPurchaseRequest.status, "approved")
        )
      )
      .orderBy(desc(pointPurchaseRequest.createdAt))

    return jsonUncached({
      history: rows.map(serializePointPurchaseRequest),
    })
  } catch (e) {
    console.error("GET /api/mobile/points/purchase-history:", e)
    return jsonError("Failed to load purchase history", 500)
  }
}
