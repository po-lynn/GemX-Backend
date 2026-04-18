import { NextRequest, connection } from "next/server"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"
import { product, productImage } from "@/drizzle/schema/product-schema"
import { user } from "@/drizzle/schema/auth-schema"
import { userFavouriteProduct } from "@/drizzle/schema/user-favourite-product-schema"
import { jsonError, jsonUncached, parseQuery } from "@/lib/api"

const bodySchema = z.object({
  productId: z.string().uuid(),
})

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

/**
 * POST /api/mobile/favourite-products
 * Save one product to authenticated user's favourites.
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const { productId } = parsed.data
    const [found] = await db
      .select({ id: product.id })
      .from(product)
      .where(eq(product.id, productId))
      .limit(1)
    if (!found) return jsonError("Product not found", 404)

    await db
      .insert(userFavouriteProduct)
      .values({ userId: session.user.id, productId })
      .onConflictDoNothing({
        target: [userFavouriteProduct.userId, userFavouriteProduct.productId],
      })

    return jsonUncached({ success: true, productId })
  } catch (e) {
    console.error("POST /api/mobile/favourite-products:", e)
    return jsonError("Failed to save favourite product", 500)
  }
}

/**
 * GET /api/mobile/favourite-products
 * Paginated list of authenticated user's favourite products.
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const { page, limit } = parseQuery(
      new URL(request.url).searchParams,
      listQuerySchema
    )
    const offset = (page - 1) * limit

    const rows = await db
      .select({
        favouriteId: userFavouriteProduct.id,
        productId: product.id,
        title: product.title,
        price: product.price,
        currency: product.currency,
        status: product.status,
        isCollectorPiece: product.isCollectorPiece,
        isPrivilegeAssist: product.isPrivilegeAssist,
        isPromotion: product.isPromotion,
        isFeatured: product.isFeatured,
        sellerId: product.sellerId,
        sellerName: user.name,
        createdAt: userFavouriteProduct.createdAt,
      })
      .from(userFavouriteProduct)
      .innerJoin(product, eq(product.id, userFavouriteProduct.productId))
      .innerJoin(user, eq(user.id, product.sellerId))
      .where(eq(userFavouriteProduct.userId, session.user.id))
      .orderBy(desc(userFavouriteProduct.createdAt))
      .limit(limit)
      .offset(offset)

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userFavouriteProduct)
      .where(eq(userFavouriteProduct.userId, session.user.id))

    const productIds = rows.map((r) => r.productId)
    const images =
      productIds.length > 0
        ? await db
            .select({
              productId: productImage.productId,
              url: productImage.url,
              sortOrder: productImage.sortOrder,
            })
            .from(productImage)
            .where(inArray(productImage.productId, productIds))
            .orderBy(productImage.sortOrder)
        : []

    const imageByProduct = new Map<string, string>()
    for (const image of images) {
      if (!imageByProduct.has(image.productId)) {
        imageByProduct.set(image.productId, image.url)
      }
    }

    return jsonUncached({
      favourites: rows.map((r) => ({
        id: r.favouriteId,
        productId: r.productId,
        createdAt: r.createdAt,
        product: {
          id: r.productId,
          title: r.title,
          price: String(r.price),
          currency: r.currency,
          status: r.status,
          isCollectorPiece: r.isCollectorPiece,
          isPrivilegeAssist: r.isPrivilegeAssist,
          isPromotion: r.isPromotion,
          isFeatured: r.isFeatured,
          sellerId: r.sellerId,
          sellerName: r.sellerName,
          imageUrl: imageByProduct.get(r.productId) ?? null,
        },
      })),
      page,
      limit,
      total: countRows[0]?.count ?? 0,
    })
  } catch (e) {
    console.error("GET /api/mobile/favourite-products:", e)
    return jsonError("Failed to load favourite products", 500)
  }
}

/**
 * DELETE /api/mobile/favourite-products
 * Remove one product from authenticated user's favourites.
 */
export async function DELETE(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const { productId } = parsed.data
    const [deleted] = await db
      .delete(userFavouriteProduct)
      .where(
        and(
          eq(userFavouriteProduct.userId, session.user.id),
          eq(userFavouriteProduct.productId, productId)
        )
      )
      .returning({ id: userFavouriteProduct.id })

    return jsonUncached({
      success: true,
      productId,
      removed: Boolean(deleted),
    })
  } catch (e) {
    console.error("DELETE /api/mobile/favourite-products:", e)
    return jsonError("Failed to remove favourite product", 500)
  }
}
