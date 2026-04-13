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
import { CollectorPieceShowRequestsTable } from "@/features/collector-piece-show-requests/components/CollectorPieceShowRequestsTable"
import { getCollectorPieceShowRequestsPaginated } from "@/features/collector-piece-show-requests/db/collector-piece-show-requests"

const PAGE_SIZE = 20

type Props = {
  searchParams: Promise<{ page?: string; status?: string }>
}

function buildPageLink(page: number, status: string) {
  const p = new URLSearchParams()
  p.set("page", String(page))
  if (status !== "all") p.set("status", status)
  return `/admin/collector-piece-show-requests?${p.toString()}`
}

export default async function AdminCollectorPieceShowRequestsPage({ searchParams }: Props) {
  await connection()
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const status =
    params.status === "pending" || params.status === "approved" || params.status === "rejected"
      ? params.status
      : "all"

  const { requests, total } = await getCollectorPieceShowRequestsPaginated({
    page,
    limit: PAGE_SIZE,
    status: status === "all" ? undefined : status,
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
          <h1 className="text-2xl font-semibold tracking-tight">Collector Piece Show Requests</h1>
          <p className="text-muted-foreground text-sm">
            Review and approve user requests to surface collector pieces
          </p>
        </div>
      </div>

      <Card className="bg-transparent border-0 shadow-none">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>All Requests</CardTitle>
            <CardDescription>
              {total} request{total !== 1 ? "s" : ""} total
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {["all", "pending", "approved", "rejected"].map((s) => (
              <Button key={s} asChild size="sm" variant={status === s ? "default" : "outline"}>
                <Link href={buildPageLink(1, s)}>{s[0]?.toUpperCase() + s.slice(1)}</Link>
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CollectorPieceShowRequestsTable requests={requests} />
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
                  <Link href={buildPageLink(page - 1, status)}>Previous</Link>
                </Button>
              )}
              {page >= totalPages ? (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
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
