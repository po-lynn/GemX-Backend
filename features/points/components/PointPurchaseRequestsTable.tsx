"use client"

import { useTransition } from "react"
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
import type { PointPurchaseRequestRow } from "@/features/points/db/points"
import {
  approvePointPurchaseRequestAction,
  rejectPointPurchaseRequestAction,
} from "@/features/points/actions/points"

type Props = {
  requests: PointPurchaseRequestRow[]
}

export function PointPurchaseRequestsTable({ requests }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function approve(requestId: string) {
    const form = new FormData()
    form.set("requestId", requestId)
    startTransition(async () => {
      const result = await approvePointPurchaseRequestAction(form)
      if (result?.error) { alert(result.error); return }
      router.refresh()
    })
  }

  function reject(requestId: string) {
    const note = prompt("Rejection reason (optional):")
    const form = new FormData()
    form.set("requestId", requestId)
    if (note) form.set("adminNote", note)
    startTransition(async () => {
      const result = await rejectPointPurchaseRequestAction(form)
      if (result?.error) { alert(result.error); return }
      router.refresh()
    })
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    }
    return (
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-slate-100 text-slate-700"}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="overflow-x-auto rounded-none border border-border">
      <Table>
        <TableHeader>
          <TableRow className="border-0 hover:bg-transparent">
            {["User", "Package", "Points", "Price", "Transferred", "Name", "Reference", "Note", "Status", "Date", "Actions"].map((h) => (
              <TableHead
                key={h}
                className="border-r last:border-r-0 border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white"
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-muted-foreground py-8 text-center">
                No purchase requests.
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
                  <div className="font-medium">{r.userName ?? "—"}</div>
                  <div className="text-muted-foreground text-xs">{r.userEmail ?? "—"}</div>
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-sm">
                  {r.packageName}
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-center text-sm font-mono">
                  {r.points}
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-center text-sm font-mono">
                  {r.price.toLocaleString()} {r.currency.toUpperCase()}
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-center text-sm font-mono">
                  {r.transferredAmount != null ? r.transferredAmount.toLocaleString() : "—"}
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-sm">
                  {r.transferredName ?? "—"}
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-sm font-mono">
                  {r.transactionReference ?? "—"}
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-sm">
                  {r.transferNote ?? "—"}
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-center text-sm">
                  {statusBadge(r.status)}
                  {r.adminNote && (
                    <div className="text-muted-foreground mt-1 text-xs">{r.adminNote}</div>
                  )}
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-xs text-muted-foreground">
                  {r.createdAt.toLocaleString()}
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  {r.status === "pending" ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() => approve(r.id)}
                        className="bg-green-600 text-white hover:bg-green-700"
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => reject(r.id)}
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
