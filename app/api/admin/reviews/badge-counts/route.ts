import { connection } from "next/server"
import type { NextRequest } from "next/server"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getReputationBadgeCounts } from "@/features/reviews/db/reputation-cases"

export async function GET(request: NextRequest) {
  await connection()
  const guard = await requireAdminOrFeature(request, FEATURE_KEYS.REVIEWS)
  if ("error" in guard) return guard.error

  const counts = await getReputationBadgeCounts()
  return Response.json(counts)
}
