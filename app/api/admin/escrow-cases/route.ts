import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { jsonError, jsonUncached } from "@/lib/api"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getStaffRole } from "@/features/staff-roles/db/staff-roles"
import { createEscrowCase, listEscrowCasesForViewer } from "@/features/escrow-cases/db/escrow-cases"
import { currencyEnum } from "@/drizzle/schema/product-schema"

const createCaseSchema = z.object({
  buyerId: z.string().trim().min(1),
  sellerId: z.string().trim().min(1),
  listingId: z.string().trim().min(1),
  assignedAgentId: z.string().trim().min(1).optional(),
  agreedPriceMinor: z.number().int().positive(),
  currency: z.enum(currencyEnum.enumValues),
})

/**
 * GET /api/admin/escrow-cases
 * Admin or a supervisor (staff_role.isSupervisor) sees every case; a plain escrow_agent
 * sees only cases assigned to them. Scope is decided here, not by the ESCROW_CASES feature
 * key alone — that key only answers "can this internal user open the page at all."
 */
export async function GET(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.ESCROW_CASES)
  if ("error" in gate) return gate.error

  try {
    const { session } = gate
    let assignedAgentId: string | undefined
    if (session.user.role !== "admin") {
      const staffRole = await getStaffRole(session.user.id)
      if (!staffRole?.isSupervisor) assignedAgentId = session.user.id
    }
    const cases = await listEscrowCasesForViewer({ viewerId: session.user.id, assignedAgentId })
    return jsonUncached({ success: true, cases })
  } catch (error) {
    console.error("GET /api/admin/escrow-cases:", error)
    return jsonError("Failed to load escrow cases", 500)
  }
}

/**
 * POST /api/admin/escrow-cases
 * Staff-initiated case creation (no mobile case-creation endpoint exists — see the
 * brief's scope note). Fee terms are snapshotted server-side from escrow_service_setting.
 */
export async function POST(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.ESCROW_CASES)
  if ("error" in gate) return gate.error

  try {
    const parsed = createCaseSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return jsonError("Invalid input", 400)
    if (parsed.data.buyerId === parsed.data.sellerId) {
      return jsonError("Buyer and seller must be different users", 400)
    }

    const created = await createEscrowCase({
      buyerId: parsed.data.buyerId,
      sellerId: parsed.data.sellerId,
      listingId: parsed.data.listingId,
      assignedAgentId: parsed.data.assignedAgentId ?? null,
      agreedPriceMinor: parsed.data.agreedPriceMinor,
      currency: parsed.data.currency,
    })
    return jsonUncached({ success: true, case: created })
  } catch (error) {
    console.error("POST /api/admin/escrow-cases:", error)
    return jsonError("Failed to create escrow case", 500)
  }
}
