import { NextRequest, connection } from "next/server"
import { getCachedPublishedBuyingGuide } from "@/features/app-content/db/cache/app-content"
import { multilangBlockNoteMobileGet } from "@/features/app-content/lib/multilang-mobile-response"

/** Public read-only Buying Guide (BlockNote JSON) for the mobile app. No auth required. */
export async function GET(request: NextRequest) {
  await connection()
  return multilangBlockNoteMobileGet(request, {
    load: getCachedPublishedBuyingGuide,
    errorMessage: "Failed to load buying guide",
    logLabel: "GET /api/mobile/buying-guide",
  })
}
