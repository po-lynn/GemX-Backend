import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { desc, eq, sql } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"
import { collectorPieceShowRequest } from "@/drizzle/schema/collector-piece-show-request-schema"
import { product } from "@/drizzle/schema/product-schema"
import { jsonError, jsonUncached } from "@/lib/api"

const bodySchema = z.object({
  productId: z.string().uuid(),
  message: z.string().trim().max(2000).optional(),
})

/**
 * POST /api/mobile/collector-piece-show-requests
 * Authenticated mobile user asks admin to surface a collector-piece listing.
 * User info is derived from the session — no client-provided snapshot needed.
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const { productId, message } = parsed.data

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

    const userInfoJson = JSON.stringify({
      name: session.user.name,
      email: session.user.email,
      phone: (session.user as { phone?: string | null }).phone ?? null,
    })

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

/**
 * GET /api/mobile/collector-piece-show-requests
 * Returns the authenticated user's own requests, newest first.
 * Query params: page (default 1), limit (default 10, max 50)
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get("page") || 1))
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 10)))
    const offset = (page - 1) * limit

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: collectorPieceShowRequest.id,
          productId: collectorPieceShowRequest.productId,
          status: collectorPieceShowRequest.status,
          message: collectorPieceShowRequest.message,
          createdAt: collectorPieceShowRequest.createdAt,
        })
        .from(collectorPieceShowRequest)
        .where(eq(collectorPieceShowRequest.userId, session.user.id))
        .orderBy(desc(collectorPieceShowRequest.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(collectorPieceShowRequest)
        .where(eq(collectorPieceShowRequest.userId, session.user.id)),
    ])

    return jsonUncached({
      requests: rows,
      page,
      limit,
      total: countRows[0]?.count ?? 0,
    })
  } catch (e) {
    console.error("GET /api/mobile/collector-piece-show-requests:", e)
    return jsonError("Failed to load requests", 500)
  }
}
