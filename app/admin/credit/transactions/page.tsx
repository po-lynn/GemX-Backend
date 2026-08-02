import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import {
  getPointTransactionsPaginated,
  getPointTransactionCounts,
} from "@/features/points/db/points"
import { PointTransactionsTable } from "@/features/points/components/PointTransactionsTable"
import { PointActionButtons } from "@/features/points/components/PointActionButtons"
import type { ViewTab } from "@/components/admin/list-view"
import { FadeUp } from "@/components/admin/motion"
import { withQueryTimeout } from "@/lib/query-timeout"
import { withTimeout } from "@/lib/db-timeout"

/** Vercel backstop: if a query hangs past this, the platform kills the render instead of it hanging on the shared connection pool indefinitely. */
export const maxDuration = 10

const ADMIN_TRANSACTIONS_QUERY_TIMEOUT_MS = 6000

const PAGE_SIZE = 20
const FILTERS = ["all", "topups", "spent", "pending"] as const
type Filter = (typeof FILTERS)[number]

/** `undefined` per field means "unknown" (query timed out) — never render this as a bare 0. */
type PointCounts = {
  all: number | undefined
  topups: number | undefined
  spent: number | undefined
  pending: number | undefined
}
const UNKNOWN_POINT_COUNTS: PointCounts = { all: undefined, topups: undefined, spent: undefined, pending: undefined }

type Props = {
  searchParams: Promise<{ filter?: string; page?: string }>
}

export default async function AdminPointTransactionsPage({ searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.CREDIT_TRANSACTIONS)
  const params = await searchParams
  const filter: Filter = (FILTERS as readonly string[]).includes(params.filter ?? "")
    ? (params.filter as Filter)
    : "all"
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)

  // Sequential, not Promise.all: the two queries never hold two pooler connections
  // open for this request at once (see docs/guides/connection-pool-and-query-timeouts.md).
  // The paginated ledger is the primary content this page exists to show, so it's
  // timeout-guarded to throw (caught by error.tsx) rather than hang indefinitely.
  const { transactions, total } = await withQueryTimeout(
    getPointTransactionsPaginated({ page, limit: PAGE_SIZE, filter }),
    ADMIN_TRANSACTIONS_QUERY_TIMEOUT_MS,
    "admin-transactions-list"
  )

  // Status counts are secondary — decorative tab badges next to an already-rendered
  // list — so they degrade gracefully instead of failing the whole page.
  // TODO: getPointTransactionCounts() (features/points/db/points.ts, ~line 1503) loads
  // every pointTransaction row and aggregates in JS instead of a SQL aggregate — an
  // unbounded full-table scan that only gets slower as the ledger grows. That's a
  // separate, worse performance issue than "needs a timeout"; follow-up should rewrite
  // it as a grouped/filtered COUNT query. Wrapping with withTimeout here only bounds
  // how long this page waits on it, it does not fix the scan itself.
  const counts = await withTimeout<PointCounts>(
    getPointTransactionCounts(),
    UNKNOWN_POINT_COUNTS,
    ADMIN_TRANSACTIONS_QUERY_TIMEOUT_MS
  )

  const views: ViewTab[] = [
    { id: "all",     label: "All",     count: counts.all },
    { id: "topups",  label: "Top-ups", count: counts.topups },
    { id: "spent",   label: "Spent",   count: counts.spent },
    { id: "pending", label: "Pending", count: counts.pending },
  ]

  return (
    <FadeUp>
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            <ChevronRight />
            <Link href="/admin/credit">Points & Credits</Link>
            <ChevronRight />
            <span className="lv-here">All Transactions</span>
          </nav>
          <h1 className="lv-h1">
            Point Transactions
            <span className="lv-h1-count">
              {counts.all !== undefined ? `${counts.all.toLocaleString()} total` : "Total unavailable"}
            </span>
          </h1>
          <p className="lv-subhead">Full ledger of every point movement across all user accounts.</p>
        </div>
        <PointActionButtons />
      </div>

      <PointTransactionsTable
        rows={transactions}
        views={views}
        activeView={filter}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
      />
    </div>
    </FadeUp>
  )
}
