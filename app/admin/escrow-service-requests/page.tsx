import Link from "next/link"
import { connection } from "next/server"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EscrowServiceRequestsTable } from "@/features/escrow-service-requests/components/EscrowServiceRequestsTable"
import { getEscrowServiceRequestsPaginated } from "@/features/escrow-service-requests/db/escrow-service-requests"

const PAGE_SIZE = 20

const STATUS_FILTERS = ["all", "pending", "contacted", "deal_made", "rejected"] as const
const TYPE_FILTERS = ["all", "buyer", "seller"] as const

type Props = {
  searchParams: Promise<{ page?: string; status?: string; type?: string }>
}

function buildPageLink(page: number, status: string, type: string) {
  const p = new URLSearchParams()
  p.set("page", String(page))
  if (status !== "all") p.set("status", status)
  if (type !== "all") p.set("type", type)
  return `/admin/escrow-service-requests?${p.toString()}`
}

export default async function AdminEscrowServiceRequestsPage({ searchParams }: Props) {
  await connection()
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const status = (STATUS_FILTERS as readonly string[]).includes(params.status ?? "")
    ? (params.status as string)
    : "all"
  const type = (TYPE_FILTERS as readonly string[]).includes(params.type ?? "")
    ? (params.type as string)
    : "all"

  const { requests, total } = await getEscrowServiceRequestsPaginated({
    page,
    limit: PAGE_SIZE,
    status: status === "all" ? undefined : status,
    type: type === "all" ? undefined : type,
  })

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="container my-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin">
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Escrow Service Requests</h1>
          <p className="text-muted-foreground text-sm">
            Review escrow requests from buyers and sellers, then contact them to facilitate the deal
          </p>
        </div>
      </div>

      <Card className="bg-transparent border-0 shadow-none">
        <CardHeader className="gap-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Requests</CardTitle>
              <CardDescription>
                {total} request{total !== 1 ? "s" : ""} total
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-sm font-medium text-muted-foreground">Status:</span>
              {STATUS_FILTERS.map((s) => (
                <Button
                  key={s}
                  asChild
                  size="sm"
                  variant={status === s ? "default" : "outline"}
                >
                  <Link href={buildPageLink(1, s, type)}>
                    {s === "all" ? "All" : s[0]?.toUpperCase() + s.slice(1).replace("_", " ")}
                  </Link>
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-sm font-medium text-muted-foreground">Type:</span>
              {TYPE_FILTERS.map((t) => (
                <Button
                  key={t}
                  asChild
                  size="sm"
                  variant={type === t ? "default" : "outline"}
                >
                  <Link href={buildPageLink(1, status, t)}>
                    {t === "all" ? "All" : t[0]?.toUpperCase() + t.slice(1)}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <EscrowServiceRequestsTable requests={requests} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              {page <= 1 ? (
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link href={buildPageLink(page - 1, status, type)}>Previous</Link>
                </Button>
              )}
              {page >= totalPages ? (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link href={buildPageLink(page + 1, status, type)}>Next</Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
