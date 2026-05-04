import Link from "next/link"
import { connection } from "next/server"
import { Button } from "@/components/ui/button"
import { EscrowServiceRequestsTable } from "@/features/escrow-service-requests/components/EscrowServiceRequestsTable"
import {
  getEscrowServiceRequestsPaginated,
  SORT_COLUMNS,
  type SortColumn,
  type SortOrder,
} from "@/features/escrow-service-requests/db/escrow-service-requests"

const PAGE_SIZE = 20
const STATUS_FILTERS = ["all", "pending", "contacted", "deal_made", "rejected"] as const
const TYPE_FILTERS = ["all", "buyer", "seller"] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]
type TypeFilter = (typeof TYPE_FILTERS)[number]

function buildLink(
  page: number,
  status: StatusFilter,
  type: TypeFilter,
  sort: SortColumn,
  order: SortOrder
) {
  const p = new URLSearchParams()
  p.set("page", String(page))
  if (status !== "all") p.set("status", status)
  if (type !== "all") p.set("type", type)
  if (sort !== "created" || order !== "desc") {
    p.set("sort", sort)
    p.set("order", order)
  }
  return `/admin/escrow-service-requests?${p.toString()}`
}

type Props = {
  searchParams: Promise<{
    page?: string
    status?: string
    type?: string
    sort?: string
    order?: string
  }>
}

export default async function AdminEscrowServiceRequestsPage({ searchParams }: Props) {
  await connection()
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const status: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(params.status ?? "")
    ? (params.status as StatusFilter)
    : "all"
  const type: TypeFilter = (TYPE_FILTERS as readonly string[]).includes(params.type ?? "")
    ? (params.type as TypeFilter)
    : "all"
  const sort: SortColumn = (SORT_COLUMNS as readonly string[]).includes(params.sort ?? "")
    ? (params.sort as SortColumn)
    : "created"
  const order: SortOrder = params.order === "asc" ? "asc" : "desc"

  const { requests, total } = await getEscrowServiceRequestsPaginated({
    page,
    limit: PAGE_SIZE,
    status: status === "all" ? undefined : status,
    type: type === "all" ? undefined : type,
    sortBy: sort,
    order,
  })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-5 py-2">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Escrow Requests
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Review escrow requests from buyers and sellers — contact to facilitate deals
          </p>
        </div>
        <span className="text-sm text-slate-500">
          {total.toLocaleString()} request{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500">Status</span>
          {STATUS_FILTERS.map((s) => (
            <Button
              key={s}
              asChild
              size="sm"
              variant={status === s ? "default" : "outline"}
              className="h-8 text-xs capitalize"
            >
              <Link href={buildLink(1, s, type, sort, order)}>
                {s === "all" ? "All" : s.replace("_", " ")}
              </Link>
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500">Type</span>
          {TYPE_FILTERS.map((t) => (
            <Button
              key={t}
              asChild
              size="sm"
              variant={type === t ? "default" : "outline"}
              className="h-8 text-xs capitalize"
            >
              <Link href={buildLink(1, status, t, sort, order)}>
                {t === "all" ? "All" : t}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <EscrowServiceRequestsTable requests={requests} sort={sort} order={order} />

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
              <Link href={buildLink(page - 1, status, type, sort, order)}>← Prev</Link>
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
              <Link href={buildLink(page + 1, status, type, sort, order)}>Next →</Link>
            ) : (
              <span>Next →</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
