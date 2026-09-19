import { Suspense } from "react"
import { connection } from "next/server"
import { requireEscrowCasesAccess } from "@/features/escrow-cases/lib/require-escrow-cases-access"
import { listEscrowCasesForViewer } from "@/features/escrow-cases/db/escrow-cases"
import { getStaffRole } from "@/features/staff-roles/db/staff-roles"
import { EscrowCaseInboxPage } from "@/features/escrow-cases/components/EscrowCaseInboxPage"
import { FadeUp } from "@/components/admin/motion"
import { withQueryTimeout } from "@/lib/query-timeout"

/** Vercel backstop: if a query hangs past this, the platform kills the render instead of it hanging on the shared connection pool indefinitely. */
export const maxDuration = 10

// Feature-access check requires the signed-in session on every load, so this page can never
// be part of a static shell — opt out of Instant Navigation validation like app/admin/queue/page.tsx.
export const instant = false

const ESCROW_CASES_QUERY_TIMEOUT_MS = 6000

export default async function AdminEscrowCasesPage() {
  await connection()
  const session = await requireEscrowCasesAccess()

  let assignedAgentId: string | undefined
  let isModerationOnly = false
  if (session.user.role !== "admin") {
    const staffRole = await getStaffRole(session.user.id)
    // Mirrors GET /api/admin/escrow-cases's scope decision: only a supervisor or a
    // moderator sees every case; anyone else (a plain agent, or no staff_role row at
    // all) conservatively defaults to "own cases only."
    if (staffRole?.role === "moderator") {
      // A moderator has no cases "assigned to them" — they see every case, same
      // breadth as a supervisor, but read-only (see EscrowCaseThreadView's canReply).
      isModerationOnly = true
    } else if (!(staffRole?.role === "escrow_agent" && staffRole.isSupervisor)) {
      assignedAgentId = session.user.id
    }
  }

  const cases = await withQueryTimeout(
    listEscrowCasesForViewer({ viewerId: session.user.id, assignedAgentId }),
    ESCROW_CASES_QUERY_TIMEOUT_MS,
    "admin-escrow-cases-list"
  )

  return (
    <FadeUp className="block h-full">
      <Suspense>
        <EscrowCaseInboxPage
          initialCases={cases}
          currentUserId={session.user.id}
          canReassign={assignedAgentId === undefined && !isModerationOnly}
          readOnly={isModerationOnly}
        />
      </Suspense>
    </FadeUp>
  )
}
