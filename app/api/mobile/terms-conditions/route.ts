import { NextRequest, connection } from "next/server"
import { getCachedPublishedTermsConditions } from "@/features/app-content/db/cache/app-content"
import { multilangBlockNoteMobileGet } from "@/features/app-content/lib/multilang-mobile-response"

/** Public read-only Terms & Conditions (BlockNote JSON) for the mobile app. No auth required. */
export async function GET(request: NextRequest) {
  await connection()
  return multilangBlockNoteMobileGet(request, {
    load: getCachedPublishedTermsConditions,
    errorMessage: "Failed to load terms & conditions",
    logLabel: "GET /api/mobile/terms-conditions",
  })
}
