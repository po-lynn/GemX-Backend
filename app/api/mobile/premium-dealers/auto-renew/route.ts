import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached } from "@/lib/api"
import { setPremiumDealerAutoRenew } from "@/features/points/db/points"

const bodySchema = z.object({
  autoRenew: z.boolean(),
})

/**
 * PATCH /api/mobile/premium-dealers/auto-renew
 * Toggle auto-renew on the authenticated user's active premium dealer subscription.
 */
export async function PATCH(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const result = await setPremiumDealerAutoRenew(session.user.id, parsed.data.autoRenew)
    if (!result) return jsonError("No active premium dealer subscription", 400)

    return jsonUncached({ success: true, autoRenew: result.autoRenew })
  } catch (e) {
    console.error("PATCH /api/mobile/premium-dealers/auto-renew:", e)
    return jsonError("Failed to update auto-renew", 500)
  }
}
