import { NextRequest, connection } from "next/server"
import { desc, eq, sql } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"
import { escrowServiceRequest } from "@/drizzle/schema/escrow-service-request-schema"
import { product } from "@/drizzle/schema/product-schema"
import { jsonError, jsonUncached, parseQuery } from "@/lib/api"
import {
  mobileSubmitEscrowSchema,
  mobileEscrowListQuerySchema,
} from "@/features/escrow-service-requests/schemas/escrow-service-requests"

/**
 * POST /api/mobile/escrow-service-requests
 * Authenticated mobile user (buyer or seller) submits an escrow service request.
 * GemX admin will contact them to facilitate a deal.
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = mobileSubmitEscrowSchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const { type, productId, message } = parsed.data

    // Verify product exists and fetch sellerId if productId provided
    let sellerId: string | null = null
    if (productId) {
      const [p] = await db
        .select({ sellerId: product.sellerId })
        .from(product)
        .where(eq(product.id, productId))
        .limit(1)
      if (!p) return jsonError("Product not found", 404)
      sellerId = p.sellerId
      // Prevent a seller from submitting a buyer-side escrow request for their own product
      if (type === "buyer" && sellerId === session.user.id) {
        return jsonError("Cannot request escrow for your own product", 400)
      }
    }

    const [row] = await db
      .insert(escrowServiceRequest)
      .values({
        userId: session.user.id,
        type,
        productId: productId ?? null,
        sellerId,
        packageName: null,
        message: message?.length ? message : null,
        status: "pending",
      })
      .returning({
        id: escrowServiceRequest.id,
        createdAt: escrowServiceRequest.createdAt,
      })

    if (!row) return jsonError("Failed to save request", 500)

    return jsonUncached({
      success: true,
      requestId: row.id,
      createdAt: row.createdAt,
    })
  } catch (e) {
    console.error("POST /api/mobile/escrow-service-requests:", e)
    return jsonError("Failed to submit escrow service request", 500)
  }
}

/**
 * GET /api/mobile/escrow-service-requests
 * Returns the authenticated user's own escrow service requests (paginated).
 * adminNote is intentionally omitted from the response.
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const { page, limit } = parseQuery(
      new URL(request.url).searchParams,
      mobileEscrowListQuerySchema,
    )
    const offset = (page - 1) * limit

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: escrowServiceRequest.id,
          type: escrowServiceRequest.type,
          productId: escrowServiceRequest.productId,
          packageName: escrowServiceRequest.packageName,
          message: escrowServiceRequest.message,
          status: escrowServiceRequest.status,
          createdAt: escrowServiceRequest.createdAt,
          updatedAt: escrowServiceRequest.updatedAt,
          productTitle: product.title,
        })
        .from(escrowServiceRequest)
        .leftJoin(product, eq(product.id, escrowServiceRequest.productId))
        .where(eq(escrowServiceRequest.userId, session.user.id))
        .orderBy(desc(escrowServiceRequest.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(escrowServiceRequest)
        .where(eq(escrowServiceRequest.userId, session.user.id)),
    ])

    return jsonUncached({
      requests: rows.map((r) => ({
        id: r.id,
        type: r.type,
        productId: r.productId,
        packageName: r.packageName,
        message: r.message,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        product: r.productTitle ? { title: r.productTitle } : null,
      })),
      page,
      limit,
      total: countRows[0]?.count ?? 0,
    })
  } catch (e) {
    console.error("GET /api/mobile/escrow-service-requests:", e)
    return jsonError("Failed to load escrow service requests", 500)
  }
}
