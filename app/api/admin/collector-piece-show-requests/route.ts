import { NextRequest, connection } from "next/server"
import { and, desc, eq, sql } from "drizzle-orm"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { product } from "@/drizzle/schema/product-schema"
import { collectorPieceShowRequest } from "@/drizzle/schema/collector-piece-show-request-schema"
import { canAdminManageUsers } from "@/features/users/permissions/users"
import { jsonError, jsonUncached } from "@/lib/api"

const querySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

async function requireAdmin(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { error: jsonError("Unauthorized", 401) }
  if (!canAdminManageUsers(session.user.role)) return { error: jsonError("Forbidden", 403) }
  return { session }
}

export async function GET(request: NextRequest) {
  await connection()
  const gate = await requireAdmin(request)
  if ("error" in gate) return gate.error

  try {
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()))
    if (!parsed.success) return jsonError("Invalid query", 400)
    const { status, page, limit } = parsed.data

    const whereClause = status ? and(eq(collectorPieceShowRequest.status, status)) : undefined
    const offset = (page - 1) * limit

    const rows = await db
      .select({
        id: collectorPieceShowRequest.id,
        userId: collectorPieceShowRequest.userId,
        productId: collectorPieceShowRequest.productId,
        userInfoJson: collectorPieceShowRequest.userInfoJson,
        message: collectorPieceShowRequest.message,
        status: collectorPieceShowRequest.status,
        createdAt: collectorPieceShowRequest.createdAt,
        requesterName: user.name,
        requesterPhone: user.phone,
        requesterEmail: user.email,
        productTitle: product.title,
        productStatus: product.status,
      })
      .from(collectorPieceShowRequest)
      .innerJoin(user, eq(user.id, collectorPieceShowRequest.userId))
      .innerJoin(product, eq(product.id, collectorPieceShowRequest.productId))
      .where(whereClause)
      .orderBy(desc(collectorPieceShowRequest.createdAt))
      .limit(limit)
      .offset(offset)

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(collectorPieceShowRequest)
      .where(whereClause)

    return jsonUncached({
      requests: rows.map((r) => {
        let userInformation: Record<string, unknown> | null = null
        try {
          const parsedInfo = JSON.parse(r.userInfoJson)
          if (parsedInfo && typeof parsedInfo === "object" && !Array.isArray(parsedInfo)) {
            userInformation = parsedInfo as Record<string, unknown>
          }
        } catch {
          userInformation = null
        }
        return {
          id: r.id,
          userId: r.userId,
          productId: r.productId,
          userInformation,
          message: r.message,
          status: r.status,
          createdAt: r.createdAt,
          requester: {
            name: r.requesterName,
            phone: r.requesterPhone,
            email: r.requesterEmail,
          },
          product: {
            title: r.productTitle,
            status: r.productStatus,
          },
        }
      }),
      page,
      limit,
      total: Number(count) || 0,
    })
  } catch (e) {
    console.error("GET /api/admin/collector-piece-show-requests:", e)
    return jsonError("Failed to load collector piece show requests", 500)
  }
}
