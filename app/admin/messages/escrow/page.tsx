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

const ESCROW_CASES_QUERY_TIMEOUT_MS = 6000

export default async function AdminEscrowCasesPage() {
  await connection()
  const session = await requireEscrowCasesAccess()

  let assignedAgentId: string | undefined
  if (session.user.role !== "admin") {
    const staffRole = await getStaffRole(session.user.id)
    if (!staffRole?.isSupervisor) assignedAgentId = session.user.id
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
          canReassign={assignedAgentId === undefined}
        />
      </Suspense>
    </FadeUp>
  )
}
