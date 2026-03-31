import { NextRequest, connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getPremiumDealersSettings } from "@/features/points/db/points"

/**
 * Public read-only mobile endpoint for premium dealer packages.
 * No auth required — mobile needs this to show premium dealer fee options.
 */
export async function GET(_request: NextRequest) {
  await connection()
  try {
    const settings = await getPremiumDealersSettings()
    return jsonCached({
      premiumDealerPackages: settings.packages.map((p) => ({
        name: p.name,
        pointsRequired: p.pointsRequired,
        serviceFeePercent: p.serviceFeePercent,
        transactionLimitUsd: p.transactionLimitUsd,
      })),
    })
  } catch (e) {
    console.error("GET /api/mobile/premium-dealers-settings:", e)
    return jsonError("Failed to load premium dealers settings", 500)
  }
}

