"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AdminTableShell,
  AdminStatusBadge,
  AdminEmptyRow,
  adminTH,
  adminTHCenter,
  adminTR,
  adminTD,
  adminTDMuted,
} from "@/components/admin/admin-ui"
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
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState("")
  const [rejectError, setRejectError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)

  function approve(requestId: string) {
    const form = new FormData()
    form.set("requestId", requestId)
    startTransition(async () => {
      await approvePointPurchaseRequestAction(form)
      router.refresh()
    })
  }

  function openReject(requestId: string) {
    setRejectTarget(requestId)
    setRejectNote("")
    setRejectError(null)
  }

  async function confirmReject() {
    if (!rejectTarget) return
    setRejectError(null)
    setRejecting(true)
    try {
      const form = new FormData()
      form.set("requestId", rejectTarget)
      if (rejectNote.trim()) form.set("adminNote", rejectNote.trim())
      const result = await rejectPointPurchaseRequestAction(form)
      if (result?.error) {
        setRejectError(result.error)
      } else {
        setRejectTarget(null)
        router.refresh()
      }
    } catch (e) {
      setRejectError(e instanceof Error ? e.message : "An unexpected error occurred.")
    } finally {
      setRejecting(false)
    }
  }

  return (
    <>
      <AdminTableShell>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className={adminTH}>User</th>
              <th className={adminTH}>Package</th>
              <th className={adminTHCenter}>Points</th>
              <th className={adminTHCenter}>Price</th>
              <th className={adminTHCenter}>Transferred</th>
              <th className={adminTH}>Transfer Name</th>
              <th className={adminTH}>Reference</th>
              <th className={adminTH}>Note</th>
              <th className={adminTHCenter}>Status</th>
              <th className={adminTH}>Date</th>
              <th className={adminTHCenter}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <AdminEmptyRow colSpan={11} message="No purchase requests found." />
            ) : (
              requests.map((r) => (
                <tr key={r.id} className={adminTR}>
                  <td className={adminTD}>
                    <div className="font-medium text-slate-800">{r.userName ?? "—"}</div>
                    <div className="text-xs text-slate-400">{r.userEmail ?? "—"}</div>
                  </td>
                  <td className={adminTD}>{r.packageName}</td>
                  <td className="px-4 py-3 text-center font-mono text-slate-700">
                    {r.points.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center font-mono text-slate-700">
                    {r.price.toLocaleString()} {r.currency.toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-slate-700">
                    {r.transferredAmount != null ? r.transferredAmount.toLocaleString() : "—"}
                  </td>
                  <td className={adminTD}>{r.transferredName ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {r.transactionReference ?? "—"}
                  </td>
                  <td className={adminTDMuted}>{r.transferNote ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <AdminStatusBadge status={r.status} />
                    {r.adminNote && (
                      <p className="mt-1 text-[11px] text-slate-400">{r.adminNote}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {r.createdAt.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "pending" ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => approve(r.id)}
                          className="h-7 gap-1 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/60 hover:bg-emerald-100 hover:text-emerald-800"
                        >
                          <CheckCircle className="size-3.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => openReject(r.id)}
                          className="h-7 gap-1 bg-red-50 px-2.5 text-xs font-medium text-red-700 ring-1 ring-red-200/60 hover:bg-red-100 hover:text-red-800"
                        >
                          <XCircle className="size-3.5" />
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </AdminTableShell>

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(v) => { if (!rejecting && !v) setRejectTarget(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Reject Purchase Request</DialogTitle>
            <DialogDescription>
              Optionally provide a reason. The request will be marked as rejected and the user will
              not receive points.
            </DialogDescription>
          </DialogHeader>
          <textarea
            placeholder="Rejection reason (optional)"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={3}
            disabled={rejecting}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
          />
          {rejectError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">
              {rejectError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectTarget(null)}
              disabled={rejecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmReject}
              disabled={rejecting}
            >
              {rejecting ? "Rejecting…" : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
