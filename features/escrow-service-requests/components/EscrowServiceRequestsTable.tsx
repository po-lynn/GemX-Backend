"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { EscrowServiceRequestRow, SortColumn, SortOrder } from "@/features/escrow-service-requests/db/escrow-service-requests"
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
  sort: SortColumn
  order: SortOrder
}

export function EscrowServiceRequestsTable({ requests, sort, order }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function sortHref(col: SortColumn) {
    const p = new URLSearchParams(searchParams.toString())
    p.set("page", "1")
    p.set("sort", col)
    p.set("order", sort === col && order === "desc" ? "asc" : "desc")
    return `/admin/escrow-service-requests?${p.toString()}`
  }

  function SortIcon({ col }: { col: SortColumn }) {
    if (sort !== col) return <ChevronsUpDown className="inline-block ml-1 size-3 opacity-50" />
    return order === "asc"
      ? <ChevronUp className="inline-block ml-1 size-3" />
      : <ChevronDown className="inline-block ml-1 size-3" />
  }
  const [modalRequest, setModalRequest] = useState<EscrowServiceRequestRow | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<Status>("pending")
  const [noteInput, setNoteInput] = useState("")

  const openModal = (r: EscrowServiceRequestRow) => {
    setModalRequest(r)
    setSelectedStatus((r.status as Status) ?? "pending")
    setNoteInput(r.adminNote ?? "")
  }

  const closeModal = () => {
    if (isPending) return
    setModalRequest(null)
    setNoteInput("")
  }

  const save = () => {
    if (!modalRequest) return
    startTransition(async () => {
      const result = await updateEscrowServiceRequestStatusAction(
        modalRequest.id,
        selectedStatus,
        noteInput.trim() || undefined,
      )
      if (result?.error) {
        alert(result.error)
        return
      }
      setModalRequest(null)
      router.refresh()
    })
  }

  return (
    <>
      <div className="overflow-x-auto rounded-none border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent">
              {(
                [
                  { label: "Type", col: "type" as SortColumn },
                  { label: "Requester" },
                  { label: "Seller" },
                  { label: "Product" },
                  { label: "Package" },
                  { label: "Message" },
                  { label: "Status", col: "status" as SortColumn },
                  { label: "Admin Note" },
                  { label: "Created", col: "created" as SortColumn },
                  { label: "Actions" },
                ] as { label: string; col?: SortColumn }[]
              ).map(({ label, col }) => (
                <TableHead
                  key={label}
                  className="border-r border-white/20 bg-gray-800 px-3 py-3 text-center text-sm font-semibold text-white last:border-r-0"
                >
                  {col ? (
                    <Link href={sortHref(col)} className="inline-flex items-center justify-center gap-0.5 hover:text-gray-200">
                      {label}
                      <SortIcon col={col} />
                    </Link>
                  ) : (
                    label
                  )}
                </TableHead>
              ))}
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
                        {r.seller.phone && (
                          <div className="text-muted-foreground text-xs">{r.seller.phone}</div>
                        )}
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
                  <TableCell className="px-3 py-2.5 text-center">
                    <Button size="sm" variant="outline" onClick={() => openModal(r)}>
                      Update
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalRequest !== null} onOpenChange={(open) => { if (!open) closeModal() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Escrow Request Status</DialogTitle>
          </DialogHeader>

          {modalRequest && (
            <div className="flex flex-col gap-4 py-2">
              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  <span className="font-medium text-foreground">Requester:</span>{" "}
                  {modalRequest.requester.name}
                </div>
                {modalRequest.product && (
                  <div>
                    <span className="font-medium text-foreground">Product:</span>{" "}
                    {modalRequest.product.title}
                  </div>
                )}
                <div>
                  <span className="font-medium text-foreground">Current status:</span>{" "}
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[(modalRequest.status as Status) ?? "pending"] ??
                      "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {STATUS_LABELS[(modalRequest.status as Status) ?? "pending"] ?? modalRequest.status}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">New Status</label>
                <select
                  className="rounded border border-border bg-background px-2 py-1.5 text-sm"
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
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Admin Note (optional)</label>
                <textarea
                  className="rounded border border-border bg-background px-2 py-1.5 text-sm resize-none"
                  rows={3}
                  placeholder="Add a note..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  disabled={isPending}
                  maxLength={5000}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeModal} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
