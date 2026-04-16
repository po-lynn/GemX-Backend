import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"
import { pointPurchaseRequest } from "@/drizzle/schema/points-schema"
import { user } from "@/drizzle/schema/auth-schema"
import { eq, desc } from "drizzle-orm"
import { jsonError, jsonUncached } from "@/lib/api"
import { canAdminManageUsers } from "@/features/users/permissions/users"

const querySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "all"]).default("pending"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

async function requireAdmin(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { error: jsonError("Unauthorized", 401) }
  if (!canAdminManageUsers(session.user.role)) return { error: jsonError("Forbidden", 403) }
  return { session }
}

/**
 * GET /api/admin/point-purchase-requests
 * List credit point purchase requests. Query params: status (pending|approved|rejected|all), page, limit.
 */
export async function GET(request: NextRequest) {
  await connection()
  const gate = await requireAdmin(request)
  if ("error" in gate) return gate.error

  try {
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()))
    if (!parsed.success) return jsonError("Invalid query", 400)
    const { status, page, limit } = parsed.data
    const offset = (page - 1) * limit

    const whereClause =
      status !== "all"
        ? eq(pointPurchaseRequest.status, status)
        : undefined

    const rows = await db
      .select({
        id: pointPurchaseRequest.id,
        userId: pointPurchaseRequest.userId,
        userName: user.name,
        userEmail: user.email,
        packageName: pointPurchaseRequest.packageName,
        points: pointPurchaseRequest.points,
        price: pointPurchaseRequest.price,
        currency: pointPurchaseRequest.currency,
        status: pointPurchaseRequest.status,
        transferredAmount: pointPurchaseRequest.transferredAmount,
        transferredName: pointPurchaseRequest.transferredName,
        transactionReference: pointPurchaseRequest.transactionReference,
        transferNote: pointPurchaseRequest.transferNote,
        adminNote: pointPurchaseRequest.adminNote,
        reviewedByAdminId: pointPurchaseRequest.reviewedByAdminId,
        reviewedAt: pointPurchaseRequest.reviewedAt,
        createdAt: pointPurchaseRequest.createdAt,
      })
      .from(pointPurchaseRequest)
      .leftJoin(user, eq(pointPurchaseRequest.userId, user.id))
      .where(whereClause)
      .orderBy(desc(pointPurchaseRequest.createdAt))
      .limit(limit)
      .offset(offset)

    return jsonUncached({
      requests: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
      })),
    })
  } catch (e) {
    console.error("GET /api/admin/point-purchase-requests:", e)
    return jsonError("Failed to load purchase requests", 500)
  }
}
