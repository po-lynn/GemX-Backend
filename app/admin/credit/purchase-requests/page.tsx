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
import { PointPurchaseRequestsTable } from "@/features/points/components/PointPurchaseRequestsTable"
import { getPointPurchaseRequestsPaginated } from "@/features/points/db/points"

const PAGE_SIZE = 20

type Props = {
  searchParams: Promise<{ page?: string; status?: string }>
}

function buildPageLink(page: number, status: string) {
  const p = new URLSearchParams()
  p.set("page", String(page))
  if (status !== "all") p.set("status", status)
  return `/admin/credit/purchase-requests?${p.toString()}`
}

export default async function AdminPointPurchaseRequestsPage({ searchParams }: Props) {
  await connection()
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const status =
    ["pending", "approved", "rejected"].includes(params.status ?? "")
      ? params.status!
      : "pending"

  const { requests, total } = await getPointPurchaseRequestsPaginated({
    page,
    limit: PAGE_SIZE,
    status,
  })

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="container my-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/credit">
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Credit Point Purchase Requests</h1>
          <p className="text-muted-foreground text-sm">
            Review KBZ Pay transfers and approve or reject point credit requests.
          </p>
        </div>
      </div>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Requests</CardTitle>
            <CardDescription>
              {total} request{total !== 1 ? "s" : ""} total
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {["pending", "approved", "rejected", "all"].map((s) => (
              <Button key={s} asChild size="sm" variant={status === s ? "default" : "outline"}>
                <Link href={buildPageLink(1, s)}>{s[0]?.toUpperCase() + s.slice(1)}</Link>
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <PointPurchaseRequestsTable requests={requests} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              {page <= 1 ? (
                <Button variant="outline" size="sm" disabled>Previous</Button>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link href={buildPageLink(page - 1, status)}>Previous</Link>
                </Button>
              )}
              {page >= totalPages ? (
                <Button variant="outline" size="sm" disabled>Next</Button>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link href={buildPageLink(page + 1, status)}>Next</Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
