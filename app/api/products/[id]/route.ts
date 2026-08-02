import { NextRequest, connection } from "next/server"
import { auth } from "@/lib/auth"
import { jsonCached, jsonUncached, jsonError } from "@/lib/api"
import { canAdminManageProducts } from "@/features/products/permissions/products"
import {
  updateProductInDb,
  deleteProductInDb,
} from "@/features/products/db/products"
import {
  getCachedProduct,
  revalidateProductsCache,
} from "@/features/products/db/cache/products"
import { getUserById } from "@/features/users/db/users"
import { productUpdateSchema } from "@/features/products/schemas/products"
import { normalizeProductBody } from "@/features/products/api/normalize-product-body"
import { deductUserPoints, getUserPointBalance } from "@/features/points/db/points"
import { getCollectorPieceShowRequestForUser } from "@/features/collector-piece-show-requests/db/collector-piece-show-requests"
import { maskPrice } from "@/lib/formatters"
import { getCachedPublicPrecautionTags } from "@/features/precaution-tags/db/cache/precaution-tags"
import { db } from "@/drizzle/db"
import { sellerRating } from "@/drizzle/schema/seller-rating-schema"
import { eq, sql } from "drizzle-orm"
import { withQueryTimeout, QueryTimeoutError } from "@/lib/query-timeout"
import { safeAll } from "@/lib/db-timeout"

/** Vercel backstop: if a query hangs past this, the platform kills the invocation instead of it running to the plan default. */
export const maxDuration = 10

/** Client-facing ceiling for the primary DB calls; leaves headroom under maxDuration for auth/session lookups. */
const PRODUCT_QUERY_TIMEOUT_MS = 6000

function jsonTimeout(message: string): Response {
  return Response.json(
    { error: message },
    { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3" } }
  )
}

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  await connection()
  try {
    const { id } = await params
    // Primary: the product record itself — nothing useful to return without it.
    const product = await withQueryTimeout(
      getCachedProduct(id),
      PRODUCT_QUERY_TIMEOUT_MS,
      "product-detail"
    )
    if (!product) return jsonError("Product not found", 404)

    // Primary: seller identity is part of the core response shape (name/username/phone),
    // not decoration. Sequential (not Promise.all with the product fetch above) so the
    // request never holds two pooler connections at once — same pattern as
    // app/api/news/route.ts / getProductById.
    const sellerUser = await withQueryTimeout(
      getUserById(product.sellerId),
      PRODUCT_QUERY_TIMEOUT_MS,
      "product-seller"
    )

    // Fast auth check, not a heavy DB round-trip in the same sense as the queries above —
    // pulled out of the Promise.all below so it doesn't hold a slot alongside real DB calls.
    const session = await auth.api.getSession({ headers: request.headers })

    let requestStatus: { id: string; status: string; createdAt: Date } | null = null
    // Secondary/decorative: rating aggregate + precaution tags enrich an already-useful
    // product response. Degrade gracefully instead of failing the whole request.
    const [sellerRatingRows, allPrecautions] = await safeAll([
      {
        promise: db
          .select({
            averageScore: sql<number>`coalesce(round(avg(${sellerRating.score})::numeric, 2), 0)::double precision`,
            totalRatings: sql<number>`count(*)::int`,
          })
          .from(sellerRating)
          .where(eq(sellerRating.sellerUserId, product.sellerId)),
        // null (not a fake {averageScore: 0, totalRatings: 0}) so a timed-out/failed lookup
        // is distinguishable downstream from a seller who genuinely has zero ratings.
        fallback: null as { averageScore: number; totalRatings: number }[] | null,
      },
      {
        promise: getCachedPublicPrecautionTags(),
        fallback: [] as Awaited<ReturnType<typeof getCachedPublicPrecautionTags>>,
      },
    ])
    const sellerRatingAgg = sellerRatingRows?.[0]
    const sellerRatingSummary = sellerRatingAgg
      ? {
          averageScore: Number(sellerRatingAgg.averageScore ?? 0),
          totalRatings: sellerRatingAgg.totalRatings ?? 0,
        }
      : null

    if (product.isCollectorPiece) {
      const isOwner = session?.user?.id === product.sellerId
      const userRequest = session
        ? await getCollectorPieceShowRequestForUser(session.user.id, id)
        : null
      requestStatus = userRequest
        ? { id: userRequest.id, status: userRequest.status, createdAt: userRequest.createdAt }
        : null
      if (!isOwner && userRequest?.status !== "approved") {
        return jsonUncached({
          id: product.id,
          isCollectorPiece: true,
          status: product.status,
          currency: product.currency,
          imageUrls: product.imageUrls,
          maskedPrice: maskPrice(product.price),
          isVerified: false,
          seller: sellerUser
            ? {
                id: sellerUser.id,
                name: sellerUser.name,
                image: sellerUser.image ?? null,
                rating: sellerRatingSummary,
              }
            : null,
          requestStatus,
        })
      }
      // Approved: fall through to full data response below
    }

    const seller = sellerUser
      ? {
          id: sellerUser.id,
          name: sellerUser.name,
          image: sellerUser.image ?? null,
          phone: sellerUser.phone ?? null,
          username: sellerUser.username ?? null,
          displayUsername: sellerUser.displayUsername ?? null,
          rating: sellerRatingSummary,
        }
      : null
    const isCertified = !!(
      product.laboratoryId ||
      product.certReportNumber ||
      product.certReportDate ||
      product.certReportUrl
    )
    const precautions = allPrecautions
      .filter((t) =>
        isCertified
          ? t.appliesTo === "certified" || t.appliesTo === "both"
          : t.appliesTo === "non_certified" || t.appliesTo === "both"
      )
      .map(({ id, name, severity }) => ({ id, name, severity }))

    const { changeLog: _adminChangeLog, verifiedBy: _verifiedBy, ...publicProduct } = product
    return jsonCached({
      ...publicProduct,
      precautions,
      seller,
      requestStatus,
    })
  } catch (error) {
    if (error instanceof QueryTimeoutError) {
      console.error("GET /api/products/[id]: timed out:", error.message)
      return jsonTimeout("Product is taking longer than usual to load — please retry")
    }
    console.error("GET /api/products/[id]:", error)
    return jsonError("Failed to fetch product", 500)
  }
}

function canEditProduct(session: { user: { id: string; role: string } }, sellerId: string) {
  return session.user.id === sellerId || canAdminManageProducts(session.user.role)
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)
    const { id } = await params
    const product = await getCachedProduct(id)
    if (!product) return jsonError("Product not found", 404)
    if (!canEditProduct(session, product.sellerId)) {
      return jsonError("Forbidden", 403)
    }
    const body = await request.json().catch(() => ({}))
    const normalized = { ...normalizeProductBody(body), productId: id }
    const parsed = productUpdateSchema.safeParse(normalized)
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
      return jsonError(msg, 400)
    }
    const { productId, ...data } = parsed.data
    const previousFeaturedPoints =
      typeof (product as { featured?: unknown }).featured === "number"
        ? ((product as { featured: number }).featured ?? 0)
        : 0
    const nextFeaturedPoints =
      data.isFeatured === true ? Math.max(0, data.featured ?? previousFeaturedPoints) : 0
    const additionalPointsNeeded = Math.max(0, nextFeaturedPoints - previousFeaturedPoints)

    if (additionalPointsNeeded > 0) {
      const { available } = await getUserPointBalance(product.sellerId)
      if (available < additionalPointsNeeded) {
        return jsonError("Insufficient points balance", 400)
      }

      const deduction = await deductUserPoints(product.sellerId, additionalPointsNeeded)
      if (!deduction.success) {
        return jsonError("Insufficient points balance", 400)
      }
    }

    await updateProductInDb(
      productId,
      {
        title: data.title,
        sku: data.sku,
        description: data.description,
        identification: data.identification,
        price: data.price,
        currency: data.currency,
        isNegotiable: data.isNegotiable,
        productType: data.productType,
        categoryId: data.categoryId,
        stoneCut: data.stoneCut,
        metal: data.metal,
        jewelleryGemstones: data.jewelleryGemstones,
        totalWeightGrams: data.totalWeightGrams,
        pieceCount: data.pieceCount,
        weightCarat: data.weightCarat,
        dimensions: data.dimensions,
        color: data.color,
        shape: data.shape,
        origin: data.origin,
        laboratoryId: data.laboratoryId,
        certReportNumber: data.certReportNumber,
        certReportDate: data.certReportDate,
        certReportUrl: data.certReportUrl,
        additionalMemos: data.additionalMemos,
        status: data.status,
        isFeatured: data.isFeatured,
        featureDurationDays: data.featureDurationDays,
        featured: data.featured,
        isCollectorPiece: data.isCollectorPiece,
        isPrivilegeAssist: data.isPrivilegeAssist,
        imageUrls: data.imageUrls,
        videoUrls: data.videoUrls,
      },
      { actorId: session.user.id }
    )
    revalidateProductsCache(productId)
    return jsonUncached({ success: true, productId })
  } catch (error) {
    console.error("PATCH /api/products/[id]:", error)
    return jsonError("Failed to update product", 500)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth.api.getSession({ headers: _request.headers })
    if (!session) return jsonError("Unauthorized", 401)
    const { id } = await params
    const product = await getCachedProduct(id)
    if (!product) return jsonError("Product not found", 404)
    if (!canEditProduct(session, product.sellerId)) {
      return jsonError("Forbidden", 403)
    }
    const deleted = await deleteProductInDb(id)
    if (!deleted) return jsonError("Product not found", 404)
    revalidateProductsCache(id)
    return jsonUncached({ success: true })
  } catch (error) {
    console.error("DELETE /api/products/[id]:", error)
    return jsonError("Failed to delete product", 500)
  }
}
