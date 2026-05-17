import { NextRequest, connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getPremiumDealersSettings } from "@/features/points/db/points"

/**
 * GET /api/mobile/premium-dealers/settings
 * Public read-only endpoint for premium dealer packages.
 * No auth required — mobile needs this to show premium dealer fee options.
 */
export async function GET(_request: NextRequest) {
  await connection()
  try {
    const settings = await getPremiumDealersSettings()
    return jsonCached({
      premiumDealerPackages: settings.packages.map((p, i) => ({
        name: p.name,
        pointsRequired: p.pointsRequired,
        durationDays: p.durationDays,
        // Second package is recommended when there are 2+ packages (matches design intent)
        recommended: settings.packages.length >= 2 && i === 1,
      })),
    })
  } catch (e) {
    console.error("GET /api/mobile/premium-dealers/settings:", e)
    return jsonError("Failed to load premium dealers settings", 500)
  }
}
