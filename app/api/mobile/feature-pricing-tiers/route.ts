import { NextRequest, connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getFeatureSettings } from "@/features/points/db/points"

/**
 * Public read-only mobile endpoint for feature pricing tiers only.
 * Source: point_setting.feature_pricing_tiers_json
 */
export async function GET(_request: NextRequest) {
  await connection()
  try {
    const settings = await getFeatureSettings()
    return jsonCached({
      featurePricingTiers: settings.pricingTiers.map((t) => ({
        durationDays: t.durationDays,
        points: t.points,
        ...(t.badge ? { badge: t.badge } : {}),
      })),
    })
  } catch (e) {
    console.error("GET /api/mobile/feature-pricing-tiers:", e)
    return jsonError("Failed to load feature pricing tiers", 500)
  }
}

