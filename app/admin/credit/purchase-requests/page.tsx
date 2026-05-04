import Link from "next/link"
import { connection } from "next/server"
import { Button } from "@/components/ui/button"
import { PointPurchaseRequestsTable } from "@/features/points/components/PointPurchaseRequestsTable"
import { getPointPurchaseRequestsPaginated } from "@/features/points/db/points"

const PAGE_SIZE = 20
const STATUS_FILTERS = ["all", "pending", "approved", "rejected"] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

function buildLink(page: number, status: StatusFilter) {
  const p = new URLSearchParams()
  p.set("page", String(page))
  if (status !== "all") p.set("status", status)
  return `/admin/credit/purchase-requests?${p.toString()}`
}

type Props = {
  searchParams: Promise<{ page?: string; status?: string }>
}

export default async function AdminPointPurchaseRequestsPage({ searchParams }: Props) {
  await connection()
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const status: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(params.status ?? "")
    ? (params.status as StatusFilter)
    : "pending"

  const { requests, total } = await getPointPurchaseRequestsPaginated({
    page,
    limit: PAGE_SIZE,
    status: status === "all" ? undefined : status,
  })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-5 py-2">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Credit Purchase Requests
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Review wire transfer submissions and approve or reject point credit requests
          </p>
        </div>
        <span className="text-sm text-slate-500">
          {total.toLocaleString()} request{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((s) => (
          <Button
            key={s}
            asChild
            size="sm"
            variant={status === s ? "default" : "outline"}
            className="h-8 text-xs capitalize"
          >
            <Link href={buildLink(1, s)}>
              {s === "all" ? "All" : s}
            </Link>
          </Button>
        ))}
      </div>

      {/* Table */}
      <PointPurchaseRequestsTable requests={requests} />

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Page {page} of {totalPages} · {total.toLocaleString()} total
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            className="h-8 text-xs"
            asChild={page > 1}
          >
            {page > 1 ? (
              <Link href={buildLink(page - 1, status)}>← Prev</Link>
            ) : (
              <span>← Prev</span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            className="h-8 text-xs"
            asChild={page < totalPages}
          >
            {page < totalPages ? (
              <Link href={buildLink(page + 1, status)}>Next →</Link>
            ) : (
              <span>Next →</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
