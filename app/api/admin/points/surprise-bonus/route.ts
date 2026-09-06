import { connection, NextRequest } from "next/server"
import { z } from "zod"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { enqueueSurpriseBonusForAllUsers } from "@/features/points/services/enqueue-surprise-bonus"

/** Allow inline drain of All Users Top-up (40–few hundred users) on Vercel. */
export const maxDuration = 60

const bodySchema = z.object({
  campaignName: z.string().trim().min(1),
  pointsPerUser: z.coerce.number().int().positive(),
  note: z.string().optional(),
})

/**
 * POST /api/admin/points/surprise-bonus
 * Create Surprise Bonus campaign + enqueue first DB job, then credit users inline
 * by default (so status reaches completed on Vercel without Edge Function).
 */
export async function POST(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.CREDIT_TRANSACTIONS)
  if ("error" in gate) return gate.error

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

  const result = await enqueueSurpriseBonusForAllUsers({
    campaignName: parsed.data.campaignName,
    pointsPerUser: parsed.data.pointsPerUser,
    note: parsed.data.note,
    createdBy: gate.session.user.id,
  })

  if ("error" in result) return jsonError(result.error, 400)

  return jsonUncached(result)
}
