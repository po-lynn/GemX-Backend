import { NextRequest, connection } from "next/server";
import { jsonCached, jsonError } from "@/lib/api";
import { getFeatureSettings } from "@/features/points/db/points";

/**
 * Public read-only feature-listing options for the mobile app (homepage featured slot limit,
 * duration × points tiers). No auth required — sellers need this to show pricing before purchase.
 */
export async function GET(_request: NextRequest) {
  await connection();
  try {
    const settings = await getFeatureSettings();
    return jsonCached(settings);
  } catch (e) {
    console.error("GET /api/mobile/feature-settings:", e);
    return jsonError("Failed to load feature settings", 500);
  }
}
