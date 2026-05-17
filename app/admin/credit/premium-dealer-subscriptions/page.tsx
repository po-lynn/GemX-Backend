import Link from "next/link"
import { ChevronRight, Download } from "lucide-react"
import { connection } from "next/server"
import { getPremiumDealerSubscriptionsPaginated } from "@/features/points/db/points"
import { PremiumDealerSubscriptionsTable } from "@/features/points/components/PremiumDealerSubscriptionsTable"
import type { ViewTab } from "@/components/admin/list-view"

const PAGE_SIZE = 20
const STATUS_FILTERS = ["all", "active", "expired", "cancelled"] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

type Props = {
  searchParams: Promise<{ page?: string; status?: string }>
}

export default async function AdminPremiumDealerSubscriptionsPage({ searchParams }: Props) {
  await connection()
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const status: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(params.status ?? "")
    ? (params.status as StatusFilter)
    : "all"

  // Fetch current page + total for each status (for tab counts)
  const [current, allCount, activeCount, expiredCount, cancelledCount] = await Promise.all([
    getPremiumDealerSubscriptionsPaginated({
      page,
      limit: PAGE_SIZE,
      status: status === "all" ? undefined : status,
    }),
    getPremiumDealerSubscriptionsPaginated({ page: 1, limit: 1 }),
    getPremiumDealerSubscriptionsPaginated({ page: 1, limit: 1, status: "active" }),
    getPremiumDealerSubscriptionsPaginated({ page: 1, limit: 1, status: "expired" }),
    getPremiumDealerSubscriptionsPaginated({ page: 1, limit: 1, status: "cancelled" }),
  ])

  const views: ViewTab[] = [
    { id: "all",       label: "All",       count: allCount.total },
    { id: "active",    label: "Active",    count: activeCount.total },
    { id: "expired",   label: "Expired",   count: expiredCount.total },
    { id: "cancelled", label: "Cancelled", count: cancelledCount.total },
  ]

  return (
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            <ChevronRight />
            <Link href="/admin/credit">Settings</Link>
            <ChevronRight />
            <span className="lv-here">Dealer Subscriptions</span>
          </nav>
          <h1 className="lv-h1">
            Premium Dealer Subscriptions
            <span className="lv-h1-count">{allCount.total} total</span>
          </h1>
          <p className="lv-subhead">
            View subscription history, deactivate active subscriptions, or manually set expiry dates.
          </p>
        </div>
        <div className="lv-pagehead-actions">
          <button className="lv-export-btn">
            <Download /> Export Excel
          </button>
        </div>
      </div>

      <PremiumDealerSubscriptionsTable
        subscriptions={current.subscriptions}
        views={views}
        activeView={status}
        page={page}
        pageSize={PAGE_SIZE}
        total={current.total}
      />
    </div>
  )
}
