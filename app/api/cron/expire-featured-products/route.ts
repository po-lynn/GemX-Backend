import { NextRequest, connection } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireCronSecret } from "@/lib/api-guard"
import { expireFeaturedProducts } from "@/features/products/db/products"

/**
 * POST /api/cron/expire-featured-products
 * Clears featured status on products whose featuredExpiresAt has passed.
 * Called daily by Vercel Cron. Secured by CRON_SECRET environment variable.
 */
export async function POST(request: NextRequest) {
  await connection()

  const authError = requireCronSecret(request)
  if (authError) return authError

  try {
    const result = await expireFeaturedProducts()
    console.log("[cron] expire-featured-products:", result)
    return jsonUncached(result)
  } catch (e) {
    console.error("[cron] expire-featured-products error:", e)
    return jsonError("Internal server error", 500)
  }
}
