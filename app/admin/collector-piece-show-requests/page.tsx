import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { CollectorPieceShowRequestsTable } from "@/features/collector-piece-show-requests/components/CollectorPieceShowRequestsTable"
import {
  getCollectorPieceShowRequestsPaginated,
  getCollectorPieceShowRequestsKPIs,
} from "@/features/collector-piece-show-requests/db/collector-piece-show-requests"
import type { ViewTab } from "@/components/admin/list-view"
import { FadeUp } from "@/components/admin/motion"

const PAGE_SIZE = 20

const VIEW_IDS = ["all", "pending", "priority", "approved", "rejected"] as const
type ViewId = (typeof VIEW_IDS)[number]


type Props = {
  searchParams: Promise<{ page?: string; view?: string }>
}

export default async function AdminCollectorPieceShowRequestsPage({ searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.COLLECTOR_REQUESTS)
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const view: ViewId = (VIEW_IDS as readonly string[]).includes(params.view ?? "")
    ? (params.view as ViewId)
    : "all"

  const isPriority = view === "priority"
  const statusFilter =
    view === "all" || isPriority
      ? undefined
      : (view as "pending" | "approved" | "rejected")

  const [{ requests, total }, kpis] = await Promise.all([
    getCollectorPieceShowRequestsPaginated({
      page,
      limit: PAGE_SIZE,
      status: statusFilter,
      isPriority,
    }),
    getCollectorPieceShowRequestsKPIs(),
  ])

  const viewTabs: ViewTab[] = [
    { id: "all",      label: "All",      count: kpis.totalCount },
    { id: "pending",  label: "Pending",  count: kpis.totalPending },
    { id: "priority", label: "Priority", count: kpis.highValuePending },
    { id: "approved", label: "Approved", count: kpis.approvedCount },
    {
      id: "rejected",
      label: "Rejected",
      count: kpis.totalCount - kpis.totalPending - kpis.approvedCount,
    },
  ]

  return (
    <FadeUp>
    <div className="space-y-5 py-2">
      {/* Page header */}
      <div className="lv-pagehead">
        <div>
          <h1 className="lv-h1">
            Collector Requests
            <span className="lv-h1-count">{kpis.totalCount.toLocaleString()} total</span>
          </h1>
          <p className="lv-subhead">
            Review and approve user requests to surface collector pieces — rare items unlocked only on request.
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="lv-kpis">
        <div className="lv-kpi" data-tone="warn">
          <span className="lv-kpi-label">
            <span className="lv-kpi-dot" />
            Pending review
          </span>
          <span className="lv-kpi-value">{kpis.totalPending.toLocaleString()}</span>
          <span className="lv-kpi-delta">Awaiting admin decision</span>
        </div>
        <div className="lv-kpi" data-tone="emer">
          <span className="lv-kpi-label">
            <span className="lv-kpi-dot" />
            Approved
          </span>
          <span className="lv-kpi-value">{kpis.approvedCount.toLocaleString()}</span>
          <span className="lv-kpi-delta">Access granted to collectors</span>
        </div>
        <div className="lv-kpi" data-tone="rose">
          <span className="lv-kpi-label">
            <span className="lv-kpi-dot" />
            Priority queue
          </span>
          <span className="lv-kpi-value">{kpis.highValuePending.toLocaleString()}</span>
          <span className="lv-kpi-delta">High-value pieces · pending</span>
        </div>
        <div className="lv-kpi" data-tone="purple">
          <span className="lv-kpi-label">
            <span className="lv-kpi-dot" />
            Total requests
          </span>
          <span className="lv-kpi-value">{kpis.totalCount.toLocaleString()}</span>
          <span className="lv-kpi-delta">All time</span>
        </div>
      </div>

      {/* Table */}
      <CollectorPieceShowRequestsTable
        requests={requests}
        views={viewTabs}
        activeView={view}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
      />


    </div>
    </FadeUp>
  )
}
