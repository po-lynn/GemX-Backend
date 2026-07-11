import { NextRequest, connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getCachedPublishedFollowUs } from "@/features/app-content/db/cache/app-content"

/** Public read-only Follow Us platform list for the mobile app. No auth required. */
export async function GET(_request: NextRequest) {
  await connection()
  try {
    const { platforms } = await getCachedPublishedFollowUs()
    const active = platforms
      .filter((p) => p.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ iconKey, customIconUrl, label, value, url }) => ({
        iconKey,
        customIconUrl,
        label,
        value,
        url,
      }))
    return jsonCached({ platforms: active })
  } catch (e) {
    console.error("GET /api/mobile/follow-us:", e)
    return jsonError("Failed to load follow us content", 500)
  }
}
