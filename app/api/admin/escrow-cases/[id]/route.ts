import { NextRequest, connection } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireEscrowCaseAccess } from "@/features/escrow-cases/lib/case-access"
import { getEscrowCaseDetail } from "@/features/escrow-cases/db/escrow-cases"

/** GET /api/admin/escrow-cases/[id] — full case context for the thread view's context panel. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await context.params
  const access = await requireEscrowCaseAccess(request, id)
  if (!access.ok) return access.error

  try {
    const detail = await getEscrowCaseDetail(id)
    if (!detail) return jsonError("Not found", 404)
    return jsonUncached({ success: true, case: detail })
  } catch (error) {
    console.error("GET /api/admin/escrow-cases/[id]:", error)
    return jsonError("Failed to load escrow case", 500)
  }
}
