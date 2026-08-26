import { connection, NextRequest } from "next/server"
import { z } from "zod"
import { jsonError, jsonUncached } from "@/lib/api"
import { sendSurpriseBonusPushToUsers } from "@/features/points/services/surprise-bonus-push"

const bodySchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(500),
  campaignId: z.string().min(1),
  campaignName: z.string().min(1),
  pointsPerUser: z.coerce.number().int().positive(),
})

/**
 * POST /api/cron/surprise-bonus-push
 * Called by the Supabase Edge Function after a surprise_bonus_batch grants credits.
 * Secured by CRON_SECRET (same as other cron routes).
 */
export async function POST(request: NextRequest) {
  await connection()

  const secret = process.env.CRON_SECRET
  if (!secret) return jsonError("Cron not configured", 500)

  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) return jsonError("Unauthorized", 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Invalid JSON body", 400)
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request body", 400)
  }

  try {
    const result = await sendSurpriseBonusPushToUsers(parsed.data)
    return jsonUncached({ success: true, ...result })
  } catch (e) {
    console.error("[cron] surprise-bonus-push error:", e)
    return jsonError("Internal server error", 500)
  }
}
