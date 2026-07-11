import { NextRequest, connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getCachedPublishedAboutUs } from "@/features/app-content/db/cache/app-content"

/** Public read-only About Us content for the mobile app. No auth required. */
export async function GET(_request: NextRequest) {
  await connection()
  try {
    const content = await getCachedPublishedAboutUs()
    return jsonCached(content)
  } catch (e) {
    console.error("GET /api/mobile/about-us:", e)
    return jsonError("Failed to load about us content", 500)
  }
}
