import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { and, eq, gte, sql } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"
import { product } from "@/drizzle/schema/product-schema"
import { user } from "@/drizzle/schema/auth-schema"
import { getFeatureSettings } from "@/features/points/db/points"
import { CACHE_CONTROL_NO_STORE, jsonError, jsonUncached } from "@/lib/api"
import { revalidateProductsCache } from "@/features/products/db/cache/products"

const bodySchema = z.object({
  durationDays: z.coerce.number().int().min(1).max(365),
  points: z.coerce.number().int().min(0),
})

type RouteParams = { params: Promise<{ id: string }> }

/**
 * Next.js returns 404 for methods with no handler; a GET here avoids the HTML
 * "page could not be found" when the URL is opened in a browser or probed with GET.
 */
export async function GET() {
  return Response.json(
    {
      error:
        "Method not allowed. Use POST with JSON: durationDays (1-365), points (non-negative).",
    },
    {
      status: 405,
      headers: {
        "Cache-Control": CACHE_CONTROL_NO_STORE,
        Allow: "POST",
      },
    }
  )
}

/**
 * POST /api/mobile/products/:id/feature
 * - Seller uses points to feature their own product
 * - Validates selected duration+points tier from admin feature settings
 * - Deducts points from user balance and marks product as featured
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const settings = await getFeatureSettings()
    const selectedTier = settings.pricingTiers.find(
      (t) =>
        t.durationDays === parsed.data.durationDays &&
        t.points === parsed.data.points
    )
    if (!selectedTier) {
      return jsonError("Invalid duration or points tier", 400)
    }

    const [row] = await db
      .select({
        id: product.id,
        sellerId: product.sellerId,
      })
      .from(product)
      .where(eq(product.id, id))
      .limit(1)
    if (!row) return jsonError("Product not found", 404)
    if (row.sellerId !== session.user.id) return jsonError("Forbidden", 403)

    const result = await db.transaction(async (tx) => {
      const [updatedUser] = await tx
        .update(user)
        .set({ points: sql`${user.points} - ${selectedTier.points}` })
        .where(
          and(
            eq(user.id, session.user.id),
            gte(user.points, selectedTier.points)
          )
        )
        .returning({ points: user.points })

      if (!updatedUser) {
        return { ok: false as const }
      }

      await tx
        .update(product)
        .set({
          isFeatured: true,
          // Reuse existing integer field to store points spent for featuring.
          featured: selectedTier.points,
        })
        .where(eq(product.id, id))

      return { ok: true as const, remainingPoints: updatedUser.points }
    })

    if (!result.ok) return jsonError("Insufficient points balance", 400)

    revalidateProductsCache(id)
    return jsonUncached({
      success: true,
      productId: id,
      durationDays: selectedTier.durationDays,
      pointsUsed: selectedTier.points,
      remainingPoints: result.remainingPoints,
    })
  } catch (error) {
    console.error("POST /api/mobile/products/[id]/feature:", error)
    return jsonError("Failed to apply featured option", 500)
  }
}

