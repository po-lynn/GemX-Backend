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
import { withQueryTimeout } from "@/lib/query-timeout"
import { withTimeout } from "@/lib/db-timeout"

/** Vercel backstop: if a query hangs past this, the platform kills the render instead of it hanging on the shared connection pool indefinitely. */
export const maxDuration = 10

const ADMIN_COLLECTOR_REQUESTS_QUERY_TIMEOUT_MS = 6000

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

  // Sequential, not Promise.all: this exact Promise.all was previously flagged as a
  // connection-pool risk (see docs/technical/connection-pool-hardening.md) but never fixed.
  // The paginated request list is the primary content the page exists to show, so it's
  // timeout-guarded and allowed to throw (caught by this route's error.tsx). The KPI tiles
  // decorate an already-useful list, so they degrade to a fallback instead of failing the
  // whole page.
  const { requests, total } = await withQueryTimeout(
    getCollectorPieceShowRequestsPaginated({
      page,
      limit: PAGE_SIZE,
      status: statusFilter,
      isPriority,
    }),
    ADMIN_COLLECTOR_REQUESTS_QUERY_TIMEOUT_MS,
    "admin-collector-requests-list"
  )
  // KNOWN LIMITATION: the KPI tiles below render `0` for both "no pending requests" and
  // "the KPI query timed out" — there's no visual distinction between a confirmed zero and
  // an unknown value. Acceptable degradation for now since the primary list still renders;
  // revisit if this KPI strip needs a genuine loading/unknown state.
  const kpiFallback = { totalPending: 0, approvedCount: 0, highValuePending: 0, totalCount: 0 }
  const kpis = await withTimeout(
    getCollectorPieceShowRequestsKPIs(),
    kpiFallback,
    ADMIN_COLLECTOR_REQUESTS_QUERY_TIMEOUT_MS
  ).catch(() => kpiFallback)

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
