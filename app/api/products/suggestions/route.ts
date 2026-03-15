import { NextRequest, connection } from "next/server"
import { jsonError, cacheHeaders } from "@/lib/api"
import { getProductSearchSuggestions } from "@/features/products/db/products"

const MIN_QUERY_LENGTH = 2
const DEFAULT_LIMIT = 5
const MAX_LIMIT = 10

/**
 * GET /api/products/suggestions?q=...&limit=...
 * Returns autocomplete suggestions (distinct product titles) for active products.
 * Ordered by: title starts with query, then contains, then newest.
 * Cache: 30s s-maxage, 60s stale-while-revalidate (suggestions change infrequently).
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim() ?? ""
    const limitParam = searchParams.get("limit")
    const limit = limitParam != null
      ? Math.min(Math.max(parseInt(limitParam, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT)
      : DEFAULT_LIMIT

    if (q.length < MIN_QUERY_LENGTH) {
      return Response.json(
        { suggestions: [] },
        { headers: { ...cacheHeaders(30, 60) } }
      )
    }

    const suggestions = await getProductSearchSuggestions(q, limit)
    return Response.json(
      { suggestions },
      { headers: { ...cacheHeaders(30, 60) } }
    )
  } catch (error) {
    console.error("GET /api/products/suggestions:", error)
    return jsonError("Failed to fetch suggestions", 500)
  }
}
