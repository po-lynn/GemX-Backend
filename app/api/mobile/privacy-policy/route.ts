import { NextRequest, connection } from "next/server"
import { getCachedPublishedPrivacyPolicy } from "@/features/app-content/db/cache/app-content"
import { multilangBlockNoteMobileGet } from "@/features/app-content/lib/multilang-mobile-response"

/** Public read-only Privacy Policy (BlockNote JSON) for the mobile app. No auth required. */
export async function GET(request: NextRequest) {
  await connection()
  return multilangBlockNoteMobileGet(request, {
    load: getCachedPublishedPrivacyPolicy,
    errorMessage: "Failed to load privacy policy",
    logLabel: "GET /api/mobile/privacy-policy",
  })
}
