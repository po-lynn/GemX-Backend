import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireEscrowThreadWriteAccess } from "@/features/escrow-cases/lib/case-access"
import {
  transitionEscrowCaseState,
  EscrowCaseConflictError,
  EscrowCaseInvalidRequestError,
  EscrowCaseNotFoundError,
} from "@/features/escrow-cases/db/case-transitions"
import { EscrowCaseStateError } from "@/features/escrow-cases/lib/state-machine"
import { escrowCaseStateEnum } from "@/drizzle/schema/escrow-case-schema"
import { broadcastCaseEvents } from "@/lib/supabase/case-broadcast"
import { sendEscrowCaseStateChangeNotification } from "@/features/notifications/services/escrow-case-notifications"

const transitionSchema = z.object({
  toState: z.enum(escrowCaseStateEnum.enumValues),
  reason: z.string().trim().max(1000).optional(),
})

/**
 * POST /api/admin/escrow-cases/[id]/transition
 * Rejects the read-only "moderation" scope (via requireEscrowThreadWriteAccess) — a
 * moderator can view a case but never drive its lifecycle. The assigned agent,
 * supervisor, or admin may transition it. "agent_assigned" can't be reached here — it's
 * only ever entered via the /assign endpoint.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await context.params
  const access = await requireEscrowThreadWriteAccess(request, id)
  if (!access.ok) return access.error

  try {
    const parsed = transitionSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return jsonError("Invalid input", 400)

    const updated = await transitionEscrowCaseState({
      caseId: id,
      toState: parsed.data.toState,
      actorId: access.session.user.id,
      reason: parsed.data.reason,
    })

    void broadcastCaseEvents(id, [
      { event: "case_state_changed", payload: { caseId: id, state: updated.state } },
    ]).catch((e) => console.error("Escrow case broadcast failed:", e))

    void sendEscrowCaseStateChangeNotification({
      caseId: id,
      state: updated.state,
      recipientIds: [updated.buyerId, updated.sellerId],
    }).catch((e) => console.error("Escrow case state-change push notification failed:", e))

    return jsonUncached({ success: true, case: updated })
  } catch (error) {
    if (error instanceof EscrowCaseNotFoundError) return jsonError("Not found", 404)
    if (error instanceof EscrowCaseInvalidRequestError) return jsonError(error.message, 400)
    if (error instanceof EscrowCaseStateError) return jsonError(error.message, 409)
    if (error instanceof EscrowCaseConflictError) return jsonError(error.message, 409)
    console.error("POST /api/admin/escrow-cases/[id]/transition:", error)
    return jsonError("Failed to update case state", 500)
  }
}
