import { NextRequest, connection } from "next/server"
import { and, desc, eq, sql } from "drizzle-orm"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { ratingTagMap } from "@/drizzle/schema/rating-tag-map-schema"
import { sellerRating } from "@/drizzle/schema/seller-rating-schema"
import { jsonError, jsonUncached, parseQuery } from "@/lib/api"
import {
  assertActiveRatingTagIds,
  getTagIdsByRatingIds,
} from "@/features/seller-ratings/db/rating-tag-maps"
import { getUserById } from "@/features/users/db/users"

const submitSchema = z.object({
  sellerId: z.string().trim().min(1),
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
  tagIds: z.array(z.string().uuid()).max(50).optional().default([]),
})

const listMyRatingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sellerId: z.string().trim().min(1).optional(),
})

/**
 * POST /api/mobile/seller-ratings
 * Create or update the current user's rating of another user (seller).
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = submitSchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const { sellerId, score, comment, tagIds } = parsed.data
    if (sellerId === session.user.id) {
      return jsonError("Cannot rate yourself", 400)
    }

    const seller = await getUserById(sellerId)
    if (!seller || seller.archived) return jsonError("Seller not found", 404)

    const uniqueTagIds = [...new Set(tagIds)]
    if (!(await assertActiveRatingTagIds(uniqueTagIds))) {
      return jsonError("Invalid or inactive tag id", 400)
    }

    const row = await db.transaction(async (tx) => {
      const [saved] = await tx
        .insert(sellerRating)
        .values({
          raterUserId: session.user.id,
          sellerUserId: sellerId,
          score,
          comment: comment?.length ? comment : null,
        })
        .onConflictDoUpdate({
          target: [sellerRating.raterUserId, sellerRating.sellerUserId],
          set: {
            score,
            comment: comment?.length ? comment : null,
            updatedAt: new Date(),
          },
        })
        .returning({
          id: sellerRating.id,
          createdAt: sellerRating.createdAt,
          updatedAt: sellerRating.updatedAt,
        })

      if (!saved) return null

      await tx.delete(ratingTagMap).where(eq(ratingTagMap.ratingId, saved.id))
      if (uniqueTagIds.length > 0) {
        await tx.insert(ratingTagMap).values(
          uniqueTagIds.map((tagId) => ({ ratingId: saved.id, tagId }))
        )
      }

      return saved
    })

    if (!row) return jsonError("Failed to save rating", 500)

    const tagIdsOut = [...uniqueTagIds].sort()

    return jsonUncached({
      success: true,
      rating: {
        id: row.id,
        sellerId,
        score,
        comment: comment?.length ? comment : null,
        tagIds: tagIdsOut,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    })
  } catch (e) {
    console.error("POST /api/mobile/seller-ratings:", e)
    return jsonError("Failed to submit seller rating", 500)
  }
}

/**
 * GET /api/mobile/seller-ratings
 * Paginated list of ratings submitted by the current user (newest first).
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const { page, limit, sellerId: filterSellerId } = parseQuery(
      new URL(request.url).searchParams,
      listMyRatingsQuerySchema
    )
    const offset = (page - 1) * limit

    const whereClause = and(
      eq(sellerRating.raterUserId, session.user.id),
      filterSellerId ? eq(sellerRating.sellerUserId, filterSellerId) : undefined
    )

    const rows = await db
      .select({
        id: sellerRating.id,
        sellerUserId: sellerRating.sellerUserId,
        score: sellerRating.score,
        comment: sellerRating.comment,
        createdAt: sellerRating.createdAt,
        updatedAt: sellerRating.updatedAt,
        sellerName: user.name,
        sellerImage: user.image,
        sellerUsername: user.username,
        sellerDisplayUsername: user.displayUsername,
      })
      .from(sellerRating)
      .innerJoin(user, eq(user.id, sellerRating.sellerUserId))
      .where(whereClause)
      .orderBy(desc(sellerRating.updatedAt))
      .limit(limit)
      .offset(offset)

    const ratingIds = rows.map((r) => r.id)
    const tagIdsByRating = await getTagIdsByRatingIds(ratingIds)

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sellerRating)
      .where(whereClause)

    return jsonUncached({
      ratings: rows.map((r) => ({
        id: r.id,
        sellerId: r.sellerUserId,
        score: r.score,
        comment: r.comment,
        tagIds: [...(tagIdsByRating.get(r.id) ?? [])].sort(),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        seller: {
          id: r.sellerUserId,
          name: r.sellerName,
          image: r.sellerImage,
          username: r.sellerUsername,
          displayUsername: r.sellerDisplayUsername,
        },
      })),
      page,
      limit,
      total: countRows[0]?.count ?? 0,
    })
  } catch (e) {
    console.error("GET /api/mobile/seller-ratings:", e)
    return jsonError("Failed to load seller ratings", 500)
  }
}
