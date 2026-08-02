import { NextResponse } from "next/server"
import { APPLE_APP_ID } from "@/lib/deep-link"

/**
 * Route handler (not a static file) so iOS gets `Content-Type: application/json`
 * with no extension and no redirect — both required for AASA verification.
 */
export function GET() {
  return NextResponse.json({
    applinks: {
      apps: [],
      details: [{ appID: APPLE_APP_ID, paths: ["/products/*"] }],
    },
  })
}
