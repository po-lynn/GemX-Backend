"use client"

import { useState, useTransition } from "react"
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
import type { EscrowServiceRequestRow } from "@/features/escrow-service-requests/db/escrow-service-requests"
import { updateEscrowServiceRequestStatusAction } from "@/features/escrow-service-requests/actions/escrow-service-requests"

const STATUS_OPTIONS = ["pending", "contacted", "deal_made", "rejected"] as const
type Status = (typeof STATUS_OPTIONS)[number]

const STATUS_LABELS: Record<Status, string> = {
  pending: "Pending",
  contacted: "Contacted",
  deal_made: "Deal Made",
  rejected: "Rejected",
}

const STATUS_STYLES: Record<Status, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  contacted: "bg-blue-100 text-blue-800",
  deal_made: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
}

type Props = {
  requests: EscrowServiceRequestRow[]
}

export function EscrowServiceRequestsTable({ requests }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<Status>("pending")
  const [noteInput, setNoteInput] = useState("")

  const startEdit = (r: EscrowServiceRequestRow) => {
    setEditingId(r.id)
    setSelectedStatus((r.status as Status) ?? "pending")
    setNoteInput(r.adminNote ?? "")
  }

  const cancelEdit = () => {
    setEditingId(null)
    setNoteInput("")
  }

  const save = (requestId: string) => {
    startTransition(async () => {
      const result = await updateEscrowServiceRequestStatusAction(
        requestId,
        selectedStatus,
        noteInput.trim() || undefined,
      )
      if (result?.error) {
        alert(result.error)
        return
      }
      setEditingId(null)
      router.refresh()
    })
  }

  return (
    <div className="overflow-x-auto rounded-none border border-border">
      <Table>
        <TableHeader>
          <TableRow className="border-0 hover:bg-transparent">
            {["Type", "Requester", "Seller", "Product", "Package", "Message", "Status", "Admin Note", "Created", "Actions"].map(
              (h) => (
                <TableHead
                  key={h}
                  className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white last:border-r-0"
                >
                  {h}
                </TableHead>
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-muted-foreground py-8 text-center">
                No escrow service requests.
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
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.type === "buyer"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-orange-100 text-orange-800"
                    }`}
                  >
                    {r.type[0]?.toUpperCase() + r.type.slice(1)}
                  </span>
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
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-sm">
                  {r.seller && r.sellerId ? (
                    <>
                      <Link
                        href={`/admin/users/${r.sellerId}/edit`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {r.seller.name}
                      </Link>
                      <div className="text-muted-foreground text-xs">{r.seller.email ?? "—"}</div>
                      <div className="text-muted-foreground text-xs">{r.seller.phone ?? "—"}</div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-sm">
                  {r.product && r.productId ? (
                    <Link
                      href={`/admin/products/${r.productId}/edit`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {r.product.title}
                    </Link>
                  ) : r.product ? (
                    <div className="font-medium">{r.product.title}</div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-sm">
                  {r.packageName ?? "—"}
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-sm">
                  {r.message ?? "—"}
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-sm">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[(r.status as Status) ?? "pending"] ??
                      "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {STATUS_LABELS[(r.status as Status) ?? "pending"] ?? r.status}
                  </span>
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-sm">
                  {r.adminNote ?? "—"}
                </TableCell>
                <TableCell className="border-r border-border/40 px-3 py-2.5 text-sm">
                  {r.createdAt.toLocaleString()}
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  {editingId === r.id ? (
                    <div className="flex flex-col gap-1.5 min-w-[180px]">
                      <select
                        className="rounded border border-border bg-background px-2 py-1 text-sm"
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value as Status)}
                        disabled={isPending}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      <textarea
                        className="rounded border border-border bg-background px-2 py-1 text-xs resize-none"
                        rows={2}
                        placeholder="Admin note (optional)"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        disabled={isPending}
                      />
                      <div className="flex gap-1">
                        <Button size="sm" disabled={isPending} onClick={() => save(r.id)}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={cancelEdit}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => startEdit(r)}>
                      Update
                    </Button>
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
