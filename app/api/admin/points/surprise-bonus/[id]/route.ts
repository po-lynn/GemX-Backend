import { connection, NextRequest } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getSurpriseBonusCampaignById } from "@/features/points/db/surprise-bonus"

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/admin/points/surprise-bonus/[id]
 * Campaign progress for admin polling.
 */
export async function GET(request: NextRequest, { params }: Params) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.CREDIT_TRANSACTIONS)
  if ("error" in gate) return gate.error

  const { id } = await params
  if (!id) return jsonError("Campaign id is required", 400)

  const campaign = await getSurpriseBonusCampaignById(id)
  if (!campaign) return jsonError("Campaign not found", 404)

  return jsonUncached({
    id: campaign.id,
    name: campaign.name,
    pointsPerUser: campaign.pointsPerUser,
    recipientType: campaign.recipientType,
    note: campaign.note,
    totalUsers: campaign.totalUsers,
    processedUsers: campaign.processedUsers,
    successCount: campaign.successCount,
    failedCount: campaign.failedCount,
    status: campaign.status,
    startedAt: campaign.startedAt?.toISOString() ?? null,
    completedAt: campaign.completedAt?.toISOString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  })
}
