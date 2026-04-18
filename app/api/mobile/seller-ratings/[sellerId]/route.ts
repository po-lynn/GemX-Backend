import { NextRequest, connection } from "next/server"
import { desc, eq, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { z } from "zod"
import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { sellerRating } from "@/drizzle/schema/seller-rating-schema"
import { jsonError, jsonUncached, parseQuery } from "@/lib/api"
import { getUserById } from "@/features/users/db/users"

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

type RouteParams = { params: Promise<{ sellerId: string }> }

const rater = alias(user, "rater")

/**
 * GET /api/mobile/seller-ratings/:sellerId
 * Public: aggregate stats + paginated ratings received by that seller.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  await connection()
  try {
    const { sellerId } = await params
    if (!sellerId?.trim()) return jsonError("Seller not found", 404)

    const seller = await getUserById(sellerId.trim())
    if (!seller || seller.archived) return jsonError("Seller not found", 404)

    const { page, limit } = parseQuery(
      new URL(request.url).searchParams,
      listQuerySchema
    )
    const offset = (page - 1) * limit

    const sellerFilter = eq(sellerRating.sellerUserId, seller.id)

    const [agg] = await db
      .select({
        avgScore: sql<number>`coalesce(round(avg(${sellerRating.score})::numeric, 2), 0)::double precision`,
        totalRatings: sql<number>`count(*)::int`,
      })
      .from(sellerRating)
      .where(sellerFilter)

    const rows = await db
      .select({
        id: sellerRating.id,
        score: sellerRating.score,
        comment: sellerRating.comment,
        createdAt: sellerRating.createdAt,
        updatedAt: sellerRating.updatedAt,
        raterName: rater.name,
        raterImage: rater.image,
      })
      .from(sellerRating)
      .innerJoin(rater, eq(rater.id, sellerRating.raterUserId))
      .where(sellerFilter)
      .orderBy(desc(sellerRating.updatedAt))
      .limit(limit)
      .offset(offset)

    const averageScore = Number(agg?.avgScore ?? 0)
    const totalRatings = agg?.totalRatings ?? 0

    return jsonUncached({
      sellerId: seller.id,
      averageScore,
      totalRatings,
      ratings: rows.map((r) => ({
        id: r.id,
        score: r.score,
        comment: r.comment,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        rater: {
          name: r.raterName,
          image: r.raterImage,
        },
      })),
      page,
      limit,
      total: agg?.totalRatings ?? 0,
    })
  } catch (e) {
    console.error("GET /api/mobile/seller-ratings/[sellerId]:", e)
    return jsonError("Failed to load seller ratings", 500)
  }
}
