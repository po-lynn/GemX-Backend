import { NextRequest, connection } from "next/server"
import { getCachedPublishedSellingGuide } from "@/features/app-content/db/cache/app-content"
import { multilangBlockNoteMobileGet } from "@/features/app-content/lib/multilang-mobile-response"

/** Public read-only Selling Guide (BlockNote JSON) for the mobile app. No auth required. */
export async function GET(request: NextRequest) {
  await connection()
  return multilangBlockNoteMobileGet(request, {
    load: getCachedPublishedSellingGuide,
    errorMessage: "Failed to load selling guide",
    logLabel: "GET /api/mobile/selling-guide",
  })
}
