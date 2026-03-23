import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached } from "@/lib/api"
import {
  creditUserPoints,
  getPointManagementSettings,
} from "@/features/points/db/points"

const bodySchema = z.object({
  currency: z.enum(["mmk", "usd", "krw"]),
  amount: z.coerce.number().positive(),
})

/**
 * POST /api/mobile/points/purchase
 * Convert payment amount to points using current point settings and
 * add those points to the logged-in user's points balance.
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const settings = await getPointManagementSettings()
    const rule = settings.currencyConversion[parsed.data.currency]

    if (!rule || rule.amount <= 0 || rule.points < 0) {
      return jsonError("Point conversion is not configured", 400)
    }

    const rawPoints = (parsed.data.amount / rule.amount) * rule.points
    const pointsToAdd = Math.max(0, Math.floor(rawPoints))
    if (pointsToAdd <= 0) {
      return jsonError("Amount is too low to earn points", 400)
    }

    const credited = await creditUserPoints(session.user.id, pointsToAdd)
    if (!credited.success || credited.updatedPoints == null) {
      return jsonError("Failed to update points balance", 500)
    }

    return jsonUncached({
      success: true,
      currency: parsed.data.currency,
      amount: parsed.data.amount,
      pointsAdded: pointsToAdd,
      pointsBalance: credited.updatedPoints,
    })
  } catch (e) {
    console.error("POST /api/mobile/points/purchase:", e)
    return jsonError("Failed to purchase points", 500)
  }
}

