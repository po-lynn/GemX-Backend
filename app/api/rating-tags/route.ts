import { connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getPublicRatingTags } from "@/features/rating-tags/db/rating-tags"

/**
 * GET /api/rating-tags
 * Public: preset seller-rating tags (`is_active` only), ordered by type then name.
 */
export async function GET() {
  await connection()
  try {
    const ratingTags = await getPublicRatingTags()
    return jsonCached({ ratingTags })
  } catch (e) {
    console.error("GET /api/rating-tags:", e)
    return jsonError("Failed to load rating tags", 500)
  }
}
