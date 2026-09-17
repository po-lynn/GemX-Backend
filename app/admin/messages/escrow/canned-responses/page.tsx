import { Suspense } from "react"
import { connection } from "next/server"
import { requireEscrowCasesAccess } from "@/features/escrow-cases/lib/require-escrow-cases-access"
import { listEscrowCannedResponses } from "@/features/escrow-cases/db/canned-responses"
import { CannedResponsesAdminPage } from "@/features/escrow-cases/components/CannedResponsesAdminPage"
import { FadeUp } from "@/components/admin/motion"
import { withQueryTimeout } from "@/lib/query-timeout"

export const maxDuration = 10

export default async function AdminEscrowCannedResponsesPage() {
  await connection()
  await requireEscrowCasesAccess()

  // activeOnly: false — the admin config page must show (and let someone re-enable)
  // disabled templates too, unlike the reply-box picker.
  const responses = await withQueryTimeout(
    listEscrowCannedResponses(false),
    6000,
    "admin-escrow-canned-responses-list"
  )

  return (
    <FadeUp className="block h-full">
      <Suspense>
        <CannedResponsesAdminPage initialResponses={responses} />
      </Suspense>
    </FadeUp>
  )
}
