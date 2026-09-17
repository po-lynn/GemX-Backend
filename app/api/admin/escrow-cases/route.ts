import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { requireAdminOrAnyFeature, requireAdminOrFeature } from "@/lib/api-guard"
import { jsonError, jsonUncached } from "@/lib/api"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getStaffRole } from "@/features/staff-roles/db/staff-roles"
import { createEscrowCase, listEscrowCasesForViewer } from "@/features/escrow-cases/db/escrow-cases"
import { currencyEnum } from "@/drizzle/schema/product-schema"
import { escrowCaseStateEnum } from "@/drizzle/schema/escrow-case-schema"

const createCaseSchema = z.object({
  buyerId: z.string().trim().min(1),
  sellerId: z.string().trim().min(1),
  listingId: z.string().trim().min(1),
  assignedAgentId: z.string().trim().min(1).optional(),
  agreedPriceMinor: z.number().int().positive(),
  currency: z.enum(currencyEnum.enumValues),
})

const searchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  state: z.enum(escrowCaseStateEnum.enumValues).optional(),
  reportedOnly: z.enum(["true", "false"]).optional(),
  dateFrom: z.string().trim().datetime().optional(),
  dateTo: z.string().trim().datetime().optional(),
})

/**
 * GET /api/admin/escrow-cases
 * Admin or a supervisor (staff_role.isSupervisor) sees every case; a plain escrow_agent
 * sees only cases assigned to them; a chat moderator (CHAT_MODERATION, no ESCROW_CASES
 * needed) sees every case too, read-only — the same "moderation" scope as a single
 * case's GET .../messages, extended to the list so oversight can actually discover a
 * case worth reviewing without already knowing its id. Scope is decided here, not by
 * either feature key alone — a key only answers "can this internal user reach this
 * endpoint at all."
 *
 * Supports real server-side search (?q=, ?state=, ?reportedOnly=, ?dateFrom=/?dateTo=)
 * — see listEscrowCasesForViewer's EscrowCaseSearchParams.
 */
export async function GET(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrAnyFeature(request, [FEATURE_KEYS.ESCROW_CASES, FEATURE_KEYS.CHAT_MODERATION])
  if ("error" in gate) return gate.error

  try {
    const { session } = gate
    const parsedQuery = searchQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsedQuery.success) return jsonError("Invalid query", 400)

    let assignedAgentId: string | undefined
    if (session.user.role !== "admin") {
      const staffRole = await getStaffRole(session.user.id)
      // Only a supervisor (escrow_agent + isSupervisor) or a moderator sees every
      // case; every other case — a plain escrow_agent, or no staff_role row at all —
      // conservatively defaults to "own cases only" (the same safe default as before
      // this endpoint knew about moderators; a non-agent with no cases assigned to
      // them simply sees an empty list, not everything).
      const staffRoleValue = staffRole?.role
      const seesEveryCase = staffRoleValue === "moderator" || (staffRoleValue === "escrow_agent" && staffRole?.isSupervisor)
      if (!seesEveryCase) assignedAgentId = session.user.id
    }

    const { q, state, reportedOnly, dateFrom, dateTo } = parsedQuery.data
    const cases = await listEscrowCasesForViewer({
      viewerId: session.user.id,
      assignedAgentId,
      search: {
        q,
        state,
        reportedOnly: reportedOnly === "true",
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      },
    })
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
      actorId: gate.session.user.id,
    })
    return jsonUncached({ success: true, case: created })
  } catch (error) {
    console.error("POST /api/admin/escrow-cases:", error)
    return jsonError("Failed to create escrow case", 500)
  }
}
