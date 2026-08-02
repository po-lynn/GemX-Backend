import Link from "next/link"
import { ChevronRight, Download } from "lucide-react"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import {
  getPremiumDealerSubscriptionsPaginated,
  getPremiumDealerSubscriptionCounts,
  getPremiumDealersSettings,
  type PremiumDealersSettings,
} from "@/features/points/db/points"
import { PremiumDealerSubscriptionsTable } from "@/features/points/components/PremiumDealerSubscriptionsTable"
import { ActivatePremiumDealerDialog } from "@/features/points/components/ActivatePremiumDealerDialog"
import type { ViewTab } from "@/components/admin/list-view"
import { FadeUp, PressButton } from "@/components/admin/motion"
import { withQueryTimeout } from "@/lib/query-timeout"
import { withTimeout } from "@/lib/db-timeout"

/** Vercel backstop: if a query hangs past this, the platform kills the render instead of it hanging on the shared connection pool indefinitely. */
export const maxDuration = 10

const ADMIN_DEALER_SUBSCRIPTIONS_QUERY_TIMEOUT_MS = 6000

const FALLBACK_DEALER_SETTINGS: PremiumDealersSettings = { packages: [] }

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

  // Primary, sequential (not Promise.all): the paginated subscriptions list is the actual
  // content this page exists to show, and the tab counts drive the same header — both
  // throw on timeout and are caught by error.tsx, mirroring app/admin/products/page.tsx.
  const current = await withQueryTimeout(
    getPremiumDealerSubscriptionsPaginated({
      page,
      limit: PAGE_SIZE,
      status: status === "all" ? undefined : status,
    }),
    ADMIN_DEALER_SUBSCRIPTIONS_QUERY_TIMEOUT_MS,
    "admin-dealer-subscriptions-list"
  )
  const counts = await withQueryTimeout(
    getPremiumDealerSubscriptionCounts(),
    ADMIN_DEALER_SUBSCRIPTIONS_QUERY_TIMEOUT_MS,
    "admin-dealer-subscriptions-counts"
  )

  // Secondary: only feeds the package options in the "activate premium dealer" dialog — it
  // doesn't gate the subscriptions list itself, so a timeout degrades to an empty package
  // list instead of failing the whole page.
  const dealerSettings = await withTimeout(
    getPremiumDealersSettings(),
    FALLBACK_DEALER_SETTINGS,
    ADMIN_DEALER_SUBSCRIPTIONS_QUERY_TIMEOUT_MS
  )

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
