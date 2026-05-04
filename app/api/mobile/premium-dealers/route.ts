import { NextRequest, connection } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { getActivePremiumDealers } from "@/features/points/db/points"
import { getPublicProfilePresenceMap } from "@/features/users/db/profile-presence"

/**
 * GET /api/mobile/premium-dealers
 * Public endpoint — returns all users with currently active (non-expired) premium dealer status.
 */
export async function GET(_request: NextRequest) {
  await connection()
  try {
    const dealers = await getActivePremiumDealers()
    const presenceMap = await getPublicProfilePresenceMap(
      dealers.map((d) => d.userId)
    )

    return jsonUncached({
      premiumDealers: dealers.map((d) => {
        const p = presenceMap.get(d.userId) ?? {
          presence: "offline" as const,
          status: "Offline",
          lastSeenAt: null,
        }
        return {
          userId: d.userId,
          name: d.name,
          username: d.username,
          image: d.image,
          packageName: d.packageName,
          expiresAt: d.expiresAt.toISOString(),
          presence: p.presence,
          status: p.status,
          lastSeenAt: p.lastSeenAt,
        }
      }),
    })
  } catch (e) {
    console.error("GET /api/mobile/premium-dealers:", e)
    return jsonError("Failed to load premium dealers", 500)
  }
}
