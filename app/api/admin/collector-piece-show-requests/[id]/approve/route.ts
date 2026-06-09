import { NextRequest, connection } from "next/server"
import { and, eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"
import { product } from "@/drizzle/schema/product-schema"
import { collectorPieceShowRequest } from "@/drizzle/schema/collector-piece-show-request-schema"
import { sendPushToUserIds } from "@/features/push/send-push"
import { jsonError, jsonUncached } from "@/lib/api"
import { checkSupervisorAccess } from "@/features/rbac/db/permissions"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"

async function requireAdminOrFeature(request: NextRequest, featureKey: string) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { error: jsonError("Unauthorized", 401) }
  if (session.user.role === "admin") return { session }
  if (session.user.role === "supervisor" && await checkSupervisorAccess(featureKey)) {
    return { session }
  }
  return { error: jsonError("Forbidden", 403) }
}

/**
 * POST /api/admin/collector-piece-show-requests/:id/approve
 * Marks request as approved and notifies the requester on mobile app.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.COLLECTOR_REQUESTS)
  if ("error" in gate) return gate.error

  try {
    const { id } = await context.params
    if (!id) return jsonError("Invalid request id", 400)

    const [existing] = await db
      .select({
        id: collectorPieceShowRequest.id,
        userId: collectorPieceShowRequest.userId,
        productId: collectorPieceShowRequest.productId,
        status: collectorPieceShowRequest.status,
        productTitle: product.title,
      })
      .from(collectorPieceShowRequest)
      .innerJoin(product, eq(product.id, collectorPieceShowRequest.productId))
      .where(eq(collectorPieceShowRequest.id, id))
      .limit(1)

    if (!existing) return jsonError("Request not found", 404)

    if (existing.status !== "pending") {
      return jsonUncached({
        success: true,
        requestId: existing.id,
        status: existing.status,
        alreadyProcessed: true,
      })
    }

    const [updated] = await db
      .update(collectorPieceShowRequest)
      .set({ status: "approved" })
      .where(and(eq(collectorPieceShowRequest.id, id), eq(collectorPieceShowRequest.status, "pending")))
      .returning({
        id: collectorPieceShowRequest.id,
        userId: collectorPieceShowRequest.userId,
        productId: collectorPieceShowRequest.productId,
        status: collectorPieceShowRequest.status,
      })

    if (!updated) {
      return jsonError("Request was already processed", 409)
    }

    const link = `/products/${updated.productId}`
    sendPushToUserIds([updated.userId], {
      title: "Collector piece request approved",
      body: existing.productTitle
        ? `${existing.productTitle} is approved to be shown.`
        : "Your collector piece request was approved.",
      data: {
        screen: "product",
        productId: updated.productId,
        link,
      },
    }).catch((e) => console.error("Collector piece approval push failed:", e))

    return jsonUncached({
      success: true,
      requestId: updated.id,
      status: updated.status,
      notifiedUserId: updated.userId,
      link,
    })
  } catch (e) {
    console.error("POST /api/admin/collector-piece-show-requests/:id/approve:", e)
    return jsonError("Failed to approve request", 500)
  }
}
