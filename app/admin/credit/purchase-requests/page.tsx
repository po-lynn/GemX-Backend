import Link from "next/link"
import { ChevronRight, Download } from "lucide-react"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import {
  getPointPurchaseRequestsPaginated,
  getPointPurchaseRequestCounts,
  getPointPurchasePackagesSettings,
  getPointManagementSettings,
  type PointPurchasePackagesSettings,
  type PointManagementSettings,
} from "@/features/points/db/points"
import { PointPurchaseRequestsTable } from "@/features/points/components/PointPurchaseRequestsTable"
import { AdminCreatePurchaseRequestDialog } from "@/features/points/components/AdminCreatePurchaseRequestDialog"
import type { ViewTab } from "@/components/admin/list-view"
import { FadeUp, PressButton } from "@/components/admin/motion"
import { withQueryTimeout } from "@/lib/query-timeout"
import { safeAll } from "@/lib/db-timeout"

/** Vercel backstop: if a query hangs past this, the platform kills the render instead of it hanging on the shared connection pool indefinitely. */
export const maxDuration = 10

const ADMIN_PURCHASE_REQUESTS_QUERY_TIMEOUT_MS = 6000

const FALLBACK_PACKAGES_SETTINGS: PointPurchasePackagesSettings = { packages: [] }
const FALLBACK_MANAGEMENT_SETTINGS: PointManagementSettings = {
  defaultRegistrationPoints: 0,
  registrationBonusEnabled: false,
  registrationBonusDescription: "",
  currencyConversion: {
    mmk: { amount: 1, points: 0 },
    usd: { amount: 1, points: 0 },
    krw: { amount: 1, points: 0 },
  },
  minimumSpendAmount: 0,
  minimumSpendCurrency: "mmk",
  roundingMethod: "nearest",
  pointExpiryDays: 0,
  paymentMethods: [],
}

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

  // Primary, sequential (not Promise.all): the paginated requests list is the actual
  // money-handling workflow (staff approve/reject KBZ Pay wire-transfer point purchases
  // here), and the tab counts drive the same header — both throw on timeout and are
  // caught by error.tsx, mirroring app/admin/products/page.tsx.
  const current = await withQueryTimeout(
    getPointPurchaseRequestsPaginated({
      page,
      limit: PAGE_SIZE,
      status: status === "all" ? undefined : status,
    }),
    ADMIN_PURCHASE_REQUESTS_QUERY_TIMEOUT_MS,
    "admin-purchase-requests-list"
  )
  const counts = await withQueryTimeout(
    getPointPurchaseRequestCounts(),
    ADMIN_PURCHASE_REQUESTS_QUERY_TIMEOUT_MS,
    "admin-purchase-requests-counts"
  )

  // Secondary: these only populate dropdown options in the "create request" dialog — they
  // don't gate the approve/reject action, so a timeout degrades to empty option lists
  // instead of failing the whole page.
  const [packagesSettings, managementSettings] = await safeAll(
    [
      { promise: getPointPurchasePackagesSettings(), fallback: FALLBACK_PACKAGES_SETTINGS },
      { promise: getPointManagementSettings(), fallback: FALLBACK_MANAGEMENT_SETTINGS },
    ],
    ADMIN_PURCHASE_REQUESTS_QUERY_TIMEOUT_MS
  )

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
            <span className="lv-here">Payment Transactions</span>
          </nav>
          <h1 className="lv-h1">
            Payment Transactions
            <span className="lv-h1-count">{counts.all} total</span>
          </h1>
          <p className="lv-subhead">
            Review wire transfer submissions and approve or reject point credit requests.
          </p>
        </div>
        <div className="lv-pagehead-actions">
          <AdminCreatePurchaseRequestDialog
            pointPackages={packagesSettings.packages}
            paymentMethods={managementSettings.paymentMethods}
          />
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
