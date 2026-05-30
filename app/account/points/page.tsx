import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { headers } from "next/headers"
import { connection } from "next/server"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import {
  getUserPointBalance,
  getUserPointHistory,
  getUserPointTransactionCounts,
} from "@/features/points/db/points"
import { UserPointBalanceHeader } from "@/features/points/components/UserPointBalanceHeader"
import { UserPointTransactionTable } from "@/features/points/components/UserPointTransactionTable"
import type { ViewTab } from "@/components/admin/list-view"

const PAGE_SIZE = 20
const FILTERS = ["all", "topups", "spent", "pending"] as const
type Filter = (typeof FILTERS)[number]

type Props = {
  searchParams: Promise<{ filter?: string; page?: string }>
}

export default async function AccountPointsPage({ searchParams }: Props) {
  await connection()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) redirect("/login")

  const params = await searchParams
  const filter: Filter = (FILTERS as readonly string[]).includes(params.filter ?? "")
    ? (params.filter as Filter)
    : "all"
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)

  const [balance, { transactions, total }, counts] = await Promise.all([
    getUserPointBalance(session.user.id),
    getUserPointHistory(session.user.id, { filter, page, limit: PAGE_SIZE }),
    getUserPointTransactionCounts(session.user.id),
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
            <Link href="/">Home</Link>
            <ChevronRight />
            <span className="lv-here">My Points</span>
          </nav>
          <h1 className="lv-h1">
            My Points
            <span className="lv-h1-count">{counts.all} transactions</span>
          </h1>
          <p className="lv-subhead">View your point balance, top-ups, and spending history.</p>
        </div>
      </div>

      <UserPointBalanceHeader
        available={balance.available}
        reserved={balance.reserved}
        lifetime={balance.lifetime}
      />

      <UserPointTransactionTable
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
