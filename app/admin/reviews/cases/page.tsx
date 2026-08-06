import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getOpenReputationCases, getReputationCaseCounts } from "@/features/reviews/db/reputation-cases"
import type { ReputationCaseTab } from "@/features/reviews/db/reputation-cases"
import { ReputationCasesTable } from "@/features/reviews/components/ReputationCasesTable"
import type { ViewTab } from "@/components/admin/list-view"
import { withQueryTimeout } from "@/lib/query-timeout"

export const maxDuration = 10

const QUERY_TIMEOUT_MS = 6000
const PAGE_SIZE = 20
const TAB_VALUES: ReputationCaseTab[] = ["all", "critical", "buyer_reports", "closed"]

type Props = {
  searchParams: Promise<{ page?: string; tab?: string }>
}

export default async function AdminReputationCasesPage({ searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.REVIEWS)

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const tab: ReputationCaseTab = TAB_VALUES.includes(params.tab as ReputationCaseTab)
    ? (params.tab as ReputationCaseTab)
    : "all"

  // Sequential, not Promise.all (see Global Constraints) — both queries hit
  // seller_rating with several aggregate scans, so they don't run concurrently.
  const current = await withQueryTimeout(
    getOpenReputationCases({ tab, page, limit: PAGE_SIZE }),
    QUERY_TIMEOUT_MS,
    "reputation-cases-page"
  )
  const counts = await withQueryTimeout(
    getReputationCaseCounts(),
    QUERY_TIMEOUT_MS,
    "reputation-cases-counts"
  )

  const views: ViewTab[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "critical", label: "Critical", count: counts.critical },
    { id: "buyer_reports", label: "Buyer reports", count: counts.buyerReports },
    { id: "closed", label: "Closed", count: counts.closed },
  ]

  return (
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <span>Admin</span> <span>›</span> <span>Reviews</span> <span>›</span>{" "}
            <span className="lv-here">Reputation cases</span>
          </nav>
          <h1 className="lv-h1">
            Reputation cases
            <span className="lv-h1-count">{counts.all} open</span>
          </h1>
          <p className="lv-subhead">
            Sellers flagged by review signals. Archive records the decision and removes the case from
            this list (storefront hiding isn&apos;t enforced in phase 1); dismiss closes the case with
            a reason.
          </p>
        </div>
      </div>

      <ReputationCasesTable
        cases={current.cases}
        views={views}
        activeTab={tab}
        page={page}
        pageSize={PAGE_SIZE}
        total={current.total}
      />
    </div>
  )
}
