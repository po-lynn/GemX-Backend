import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireEscrowCaseAccess } from "@/features/escrow-cases/lib/case-access"
import {
  setEscrowCaseAgent,
  EscrowCaseConflictError,
  EscrowCaseInvalidRequestError,
  EscrowCaseNotFoundError,
} from "@/features/escrow-cases/db/case-transitions"
import { broadcastCaseEvents } from "@/lib/supabase/case-broadcast"

const assignSchema = z.object({
  agentId: z.string().trim().min(1),
})

/**
 * POST /api/admin/escrow-cases/[id]/assign
 * Supervisor/admin only — a plain assigned agent can drive their own case's state but
 * can't hand it to someone else. Handles both a first assignment and a reassignment;
 * setEscrowCaseAgent decides which based on whether the case already has an agent.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await context.params
  const access = await requireEscrowCaseAccess(request, id)
  if (!access.ok) return access.error
  if (access.scope !== "admin" && access.scope !== "supervisor") {
    return jsonError("Only a supervisor or admin can assign or reassign a case", 403)
  }

  try {
    const parsed = assignSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return jsonError("Invalid input", 400)

    const [newAgent] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, parsed.data.agentId))
      .limit(1)
    if (!newAgent) return jsonError("Agent not found", 404)

    let previousAgentName: string | null = null
    if (access.case.assignedAgentId) {
      const [prev] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, access.case.assignedAgentId))
        .limit(1)
      previousAgentName = prev?.name ?? null
    }

    const updated = await setEscrowCaseAgent({
      caseId: id,
      agentId: parsed.data.agentId,
      agentName: newAgent.name,
      actorId: access.session.user.id,
      previousAgentName,
    })

    void broadcastCaseEvents(id, [
      { event: "case_state_changed", payload: { caseId: id, state: updated.state } },
    ]).catch((e) => console.error("Escrow case broadcast failed:", e))

    return jsonUncached({ success: true, case: updated })
  } catch (error) {
    if (error instanceof EscrowCaseNotFoundError) return jsonError("Not found", 404)
    if (error instanceof EscrowCaseInvalidRequestError) return jsonError(error.message, 400)
    if (error instanceof EscrowCaseConflictError) return jsonError(error.message, 409)
    console.error("POST /api/admin/escrow-cases/[id]/assign:", error)
    return jsonError("Failed to assign case", 500)
  }
}
