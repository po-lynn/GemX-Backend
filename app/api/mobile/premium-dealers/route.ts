import { NextRequest, connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getActivePremiumDealers } from "@/features/points/db/points"

/**
 * GET /api/mobile/premium-dealers
 * Public endpoint — returns all users with currently active (non-expired) premium dealer status.
 */
export async function GET(_request: NextRequest) {
  await connection()
  try {
    const dealers = await getActivePremiumDealers()
    return jsonCached({
      premiumDealers: dealers.map((d) => ({
        userId: d.userId,
        name: d.name,
        username: d.username,
        packageName: d.packageName,
        expiresAt: d.expiresAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error("GET /api/mobile/premium-dealers:", e)
    return jsonError("Failed to load premium dealers", 500)
  }
}
