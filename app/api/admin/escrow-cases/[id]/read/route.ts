import { NextRequest, connection } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireEscrowCaseAccess } from "@/features/escrow-cases/lib/case-access"
import { markEscrowCaseRead } from "@/features/escrow-cases/db/case-messages"
import { broadcastCaseEvents } from "@/lib/supabase/case-broadcast"

/** PATCH /api/admin/escrow-cases/[id]/read — marks the caller's own read cursor; never
 *  affects another viewer's unread state, so any access scope (including moderation) may
 *  call this for themselves. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await context.params
  const access = await requireEscrowCaseAccess(request, id)
  if (!access.ok) return access.error

  try {
    const userId = access.session.user.id
    await markEscrowCaseRead(id, userId)
    const lastReadAt = new Date().toISOString()
    void broadcastCaseEvents(id, [{ event: "case_read_update", payload: { caseId: id, userId, lastReadAt } }]).catch(
      (e) => console.error("Escrow case read broadcast failed:", e)
    )
    return jsonUncached({ success: true })
  } catch (error) {
    console.error("PATCH /api/admin/escrow-cases/[id]/read:", error)
    return jsonError("Failed to mark case read", 500)
  }
}
