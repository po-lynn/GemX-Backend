import { NextRequest, connection } from "next/server";
import { jsonCached, jsonError } from "@/lib/api";
import { getPointManagementSettings } from "@/features/points/db/points";

/**
 * Public read-only point rules for the mobile app (earning conversion, registration bonus,
 * minimum spend, rounding, expiry). No auth required — same config for all users.
 */
export async function GET(_request: NextRequest) {
  await connection();
  try {
    const settings = await getPointManagementSettings();
    return jsonCached(settings);
  } catch (e) {
    console.error("GET /api/mobile/point-settings:", e);
    return jsonError("Failed to load point settings", 500);
  }
}
