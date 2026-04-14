"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CollectorPieceShowRequestRow } from "@/features/collector-piece-show-requests/db/collector-piece-show-requests"
import { approveCollectorPieceShowRequestAction } from "@/features/collector-piece-show-requests/actions/collector-piece-show-requests"

type Props = {
  requests: CollectorPieceShowRequestRow[]
}

export function CollectorPieceShowRequestsTable({ requests }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const approve = (requestId: string) => {
    const form = new FormData()
    form.set("requestId", requestId)
    startTransition(async () => {
      const result = await approveCollectorPieceShowRequestAction(form)
      if (result?.error) {
        alert(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="overflow-x-auto rounded-none border border-border">
      <Table>
        <TableHeader>
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
              Product
            </TableHead>
            <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
              Requester
            </TableHead>
            <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
              Message
            </TableHead>
            <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
              Status
            </TableHead>
            <TableHead className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
              Created
            </TableHead>
            <TableHead className="bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                No collector piece show requests.
              </TableCell>
            </TableRow>
          ) : (
            requests.map((r, index) => (
              <TableRow
                key={r.id}
                className={`border-b border-border/50 transition-colors last:border-0 ${
                  index % 2 === 1 ? "bg-[#f5f5f5]" : ""
                }`}
              >
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-sm">
                  <Link
                    href={`/admin/products/${r.productId}/edit`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {r.product.title}
                  </Link>
                  <div className="text-muted-foreground text-xs">Listing status: {r.product.status}</div>
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-sm">
                  <Link
                    href={`/admin/users/${r.userId}/edit`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {r.requester.name}
                  </Link>
                  <div className="text-muted-foreground text-xs">{r.requester.email}</div>
                  <div className="text-muted-foreground text-xs">{r.requester.phone ?? "—"}</div>
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-left text-sm">
                  {r.message ?? "—"}
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-left text-sm">
                  {r.status}
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-left text-sm">
                  {r.createdAt.toLocaleString()}
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <Button
                    size="sm"
                    disabled={isPending || r.status !== "pending"}
                    onClick={() => approve(r.id)}
                  >
                    {r.status === "pending" ? "Approve" : "Approved"}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
