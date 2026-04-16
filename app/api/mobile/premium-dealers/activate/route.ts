import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached } from "@/lib/api"
import { activatePremiumDealer, getPremiumDealersSettings } from "@/features/points/db/points"

const bodySchema = z.object({
  packageName: z.string().min(1).max(120),
})

/**
 * POST /api/mobile/premium-dealers/activate
 * Spend points to activate premium dealer status for the selected package duration.
 * Points are deducted atomically; returns 400 if balance is insufficient.
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const settings = await getPremiumDealersSettings()
    const pkg = settings.packages.find((p) => p.name === parsed.data.packageName)
    if (!pkg) return jsonError("Package not found", 400)

    const result = await activatePremiumDealer(session.user.id, pkg)
    if (!result) return jsonError("Insufficient points balance", 400)

    return jsonUncached({
      success: true,
      packageName: pkg.name,
      pointsUsed: pkg.pointsRequired,
      remainingPoints: result.remainingPoints,
      expiresAt: result.expiresAt.toISOString(),
    })
  } catch (e) {
    console.error("POST /api/mobile/premium-dealers/activate:", e)
    return jsonError("Failed to activate premium dealer status", 500)
  }
}
