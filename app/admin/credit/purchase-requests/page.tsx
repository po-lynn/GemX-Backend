import Link from "next/link"
import { ChevronRight, Download } from "lucide-react"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import {
  getPointPurchaseRequestsPaginated,
  getPointPurchaseRequestCounts,
} from "@/features/points/db/points"
import { PointPurchaseRequestsTable } from "@/features/points/components/PointPurchaseRequestsTable"
import type { ViewTab } from "@/components/admin/list-view"
import { FadeUp, PressButton } from "@/components/admin/motion"

const PAGE_SIZE = 20
const STATUS_FILTERS = ["all", "pending", "approved", "rejected"] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

type Props = {
  searchParams: Promise<{ page?: string; status?: string }>
}

export default async function AdminPointPurchaseRequestsPage({ searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.CREDIT_PURCHASE_REQUESTS)
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const status: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(params.status ?? "")
    ? (params.status as StatusFilter)
    : "all"

  const current = await getPointPurchaseRequestsPaginated({
    page,
    limit: PAGE_SIZE,
    status: status === "all" ? undefined : status,
  })
  const counts = await getPointPurchaseRequestCounts()

  const views: ViewTab[] = [
    { id: "all",      label: "All",      count: counts.all },
    { id: "pending",  label: "Pending",  count: counts.pending },
    { id: "approved", label: "Approved", count: counts.approved },
    { id: "rejected", label: "Rejected", count: counts.rejected },
  ]

  return (
    <FadeUp>
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            <ChevronRight />
            <Link href="/admin/credit">Settings</Link>
            <ChevronRight />
            <span className="lv-here">Credit Purchase Requests</span>
          </nav>
          <h1 className="lv-h1">
            Credit Purchase Requests
            <span className="lv-h1-count">{counts.all} total</span>
          </h1>
          <p className="lv-subhead">
            Review wire transfer submissions and approve or reject point credit requests.
          </p>
        </div>
        <div className="lv-pagehead-actions">
          <PressButton className="lv-export-btn">
            <Download /> Export Excel
          </PressButton>
        </div>
      </div>

      <PointPurchaseRequestsTable
        requests={current.requests}
        views={views}
        activeView={status}
        page={page}
        pageSize={PAGE_SIZE}
        total={current.total}
      />
    </div>
    </FadeUp>
  )
}
