import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"
import { collectorPieceShowRequest } from "@/drizzle/schema/collector-piece-show-request-schema"
import { product } from "@/drizzle/schema/product-schema"
import { jsonError, jsonUncached } from "@/lib/api"

const bodySchema = z.object({
  productId: z.string().uuid(),
  /** Snapshot from mobile (name, phone, email, etc.) — stored as JSON string */
  userInformation: z.record(z.string(), z.unknown()),
  message: z.string().trim().max(2000).optional(),
})

/**
 * POST /api/mobile/collector-piece-show-requests
 * Authenticated mobile user asks admin to surface a collector-piece listing.
 * Persists requester id, product id, and client-provided user snapshot JSON.
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const { productId, userInformation, message } = parsed.data

    const [p] = await db
      .select({
        id: product.id,
        isCollectorPiece: product.isCollectorPiece,
      })
      .from(product)
      .where(eq(product.id, productId))
      .limit(1)

    if (!p) return jsonError("Product not found", 404)
    if (!p.isCollectorPiece) {
      return jsonError("Product is not a collector piece", 400)
    }

    let userInfoJson: string
    try {
      userInfoJson = JSON.stringify(userInformation)
    } catch {
      return jsonError("userInformation must be JSON-serializable", 400)
    }
    if (userInfoJson.length > 50_000) {
      return jsonError("userInformation is too large", 400)
    }

    const [row] = await db
      .insert(collectorPieceShowRequest)
      .values({
        userId: session.user.id,
        productId,
        userInfoJson,
        message: message?.length ? message : null,
        status: "pending",
      })
      .returning({
        id: collectorPieceShowRequest.id,
        createdAt: collectorPieceShowRequest.createdAt,
      })

    if (!row) return jsonError("Failed to save request", 500)

    return jsonUncached({
      success: true,
      requestId: row.id,
      productId,
      createdAt: row.createdAt,
    })
  } catch (e) {
    console.error("POST /api/mobile/collector-piece-show-requests:", e)
    return jsonError("Failed to submit collector piece show request", 500)
  }
}
