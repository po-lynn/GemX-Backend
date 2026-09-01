import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached } from "@/lib/api"
import { upgradePremiumDealerPackage } from "@/features/points/db/points"

const bodySchema = z.object({
  targetPackageName: z.string().trim().min(1).max(120),
})

const UPGRADE_ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  no_active_subscription: {
    status: 409,
    message: "No active premium dealer subscription to upgrade",
  },
  current_package_not_found: {
    status: 409,
    message: "Current premium dealer package is no longer available",
  },
  target_package_not_found: {
    status: 404,
    message: "Package not found",
  },
  target_not_higher: {
    status: 409,
    message: "Target package must be a higher tier than your current package",
  },
  insufficient_points: {
    status: 422,
    message: "Insufficient points balance",
  },
}

/**
 * POST /api/mobile/premium-dealers/upgrade
 * Upgrade the user's active premium dealer package by paying only the points
 * difference between tiers. Prices and levels are resolved server-side.
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid upgrade request", 400)

    const result = await upgradePremiumDealerPackage(
      session.user.id,
      parsed.data.targetPackageName,
    )

    if (!result.success) {
      const mapped = UPGRADE_ERROR_MESSAGES[result.reason]
      return jsonError(mapped.message, mapped.status)
    }

    return jsonUncached({
      success: true,
      previousPackageName: result.previousPackageName,
      packageName: result.packageName,
      pointsUsed: result.pointsUsed,
      remainingPoints: result.remainingPoints,
      startDate: result.startDate.toISOString(),
      expiresAt: result.expiresAt.toISOString(),
      autoRenew: result.autoRenew,
      status: result.status,
    })
  } catch (e) {
    console.error("POST /api/mobile/premium-dealers/upgrade:", e)
    return jsonError("Failed to upgrade premium dealer package", 500)
  }
}
