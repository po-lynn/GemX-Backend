import Link from "next/link"
import { ChevronRight, Download } from "lucide-react"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import {
  getPremiumDealerSubscriptionsPaginated,
  getPremiumDealerSubscriptionCounts,
  getPremiumDealersSettings,
} from "@/features/points/db/points"
import { PremiumDealerSubscriptionsTable } from "@/features/points/components/PremiumDealerSubscriptionsTable"
import { ActivatePremiumDealerDialog } from "@/features/points/components/ActivatePremiumDealerDialog"
import type { ViewTab } from "@/components/admin/list-view"
import { FadeUp, PressButton } from "@/components/admin/motion"

const PAGE_SIZE = 20
const STATUS_FILTERS = ["all", "active", "expired", "cancelled"] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

type Props = {
  searchParams: Promise<{ page?: string; status?: string }>
}

export default async function AdminPremiumDealerSubscriptionsPage({ searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.CREDIT_SUBSCRIPTIONS)
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const status: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(params.status ?? "")
    ? (params.status as StatusFilter)
    : "all"

  const [current, counts, dealerSettings] = await Promise.all([
    getPremiumDealerSubscriptionsPaginated({
      page,
      limit: PAGE_SIZE,
      status: status === "all" ? undefined : status,
    }),
    getPremiumDealerSubscriptionCounts(),
    getPremiumDealersSettings(),
  ])

  const views: ViewTab[] = [
    { id: "all",       label: "All",       count: counts.all },
    { id: "active",    label: "Active",    count: counts.active },
    { id: "expired",   label: "Expired",   count: counts.expired },
    { id: "cancelled", label: "Cancelled", count: counts.cancelled },
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
            <span className="lv-here">Dealer Subscriptions</span>
          </nav>
          <h1 className="lv-h1">
            Premium Dealer Subscriptions
            <span className="lv-h1-count">{counts.all} total</span>
          </h1>
          <p className="lv-subhead">
            View subscription history, deactivate active subscriptions, or manually set expiry dates.
          </p>
        </div>
        <div className="lv-pagehead-actions">
          <ActivatePremiumDealerDialog
            packages={dealerSettings.packages}
          />
          <PressButton className="lv-export-btn">
            <Download /> Export Excel
          </PressButton>
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
    </FadeUp>
  )
}
