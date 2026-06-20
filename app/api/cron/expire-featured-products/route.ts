import { NextRequest, connection } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { expireFeaturedProducts } from "@/features/products/db/products"

/**
 * POST /api/cron/expire-featured-products
 * Clears featured status on products whose featuredExpiresAt has passed.
 * Called daily by Vercel Cron. Secured by CRON_SECRET environment variable.
 */
export async function POST(request: NextRequest) {
  await connection()

  const secret = process.env.CRON_SECRET
  if (!secret) return jsonError("Cron not configured", 500)

  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) return jsonError("Unauthorized", 401)

  try {
    const result = await expireFeaturedProducts()
    console.log("[cron] expire-featured-products:", result)
    return jsonUncached(result)
  } catch (e) {
    console.error("[cron] expire-featured-products error:", e)
    return jsonError("Internal server error", 500)
  }
}
