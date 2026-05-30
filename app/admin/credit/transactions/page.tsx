import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { connection } from "next/server"
import {
  getPointTransactionsPaginated,
  getPointTransactionCounts,
} from "@/features/points/db/points"
import { PointTransactionsTable } from "@/features/points/components/PointTransactionsTable"
import type { ViewTab } from "@/components/admin/list-view"

const PAGE_SIZE = 20
const FILTERS = ["all", "topups", "spent", "pending"] as const
type Filter = (typeof FILTERS)[number]

type Props = {
  searchParams: Promise<{ filter?: string; page?: string }>
}

export default async function AdminPointTransactionsPage({ searchParams }: Props) {
  await connection()
  const params = await searchParams
  const filter: Filter = (FILTERS as readonly string[]).includes(params.filter ?? "")
    ? (params.filter as Filter)
    : "all"
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)

  const [{ transactions, total }, counts] = await Promise.all([
    getPointTransactionsPaginated({ page, limit: PAGE_SIZE, filter }),
    getPointTransactionCounts(),
  ])

  const views: ViewTab[] = [
    { id: "all",     label: "All",     count: counts.all },
    { id: "topups",  label: "Top-ups", count: counts.topups },
    { id: "spent",   label: "Spent",   count: counts.spent },
    { id: "pending", label: "Pending", count: counts.pending },
  ]

  return (
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
            <span className="lv-h1-count">{counts.all} total</span>
          </h1>
          <p className="lv-subhead">Full ledger of every point movement across all user accounts.</p>
        </div>
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
  )
}
