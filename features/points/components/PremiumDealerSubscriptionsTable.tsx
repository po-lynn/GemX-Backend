"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Ban, CalendarClock } from "lucide-react"
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
import type { PremiumDealerSubscriptionRow } from "@/features/points/db/points"
import {
  deactivatePremiumDealerAction,
  updateSubscriptionExpiryAction,
} from "@/features/points/actions/points"

function daysRemaining(endDate: Date): number {
  return Math.max(
    0,
    Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  )
}

function toDateInputValue(date: Date): string {
  return new Date(date).toISOString().slice(0, 10)
}

type Props = {
  subscriptions: PremiumDealerSubscriptionRow[]
}

export function PremiumDealerSubscriptionsTable({ subscriptions }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Deactivate dialog state
  const [deactivateTarget, setDeactivateTarget] = useState<string | null>(null)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  // Set expiry dialog state
  const [expiryTarget, setExpiryTarget] = useState<PremiumDealerSubscriptionRow | null>(null)
  const [expiryDate, setExpiryDate] = useState("")
  const [expiryError, setExpiryError] = useState<string | null>(null)
  const [updatingExpiry, setUpdatingExpiry] = useState(false)

  function openDeactivate(id: string) {
    setDeactivateTarget(id)
    setDeactivateError(null)
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return
    setDeactivateError(null)
    setDeactivating(true)
    try {
      const form = new FormData()
      form.set("subscriptionId", deactivateTarget)
      const result = await deactivatePremiumDealerAction(form)
      if (result?.error) {
        setDeactivateError(result.error)
      } else {
        setDeactivateTarget(null)
        startTransition(() => router.refresh())
      }
    } catch (e) {
      setDeactivateError(e instanceof Error ? e.message : "An unexpected error occurred.")
    } finally {
      setDeactivating(false)
    }
  }

  function openSetExpiry(row: PremiumDealerSubscriptionRow) {
    setExpiryTarget(row)
    setExpiryDate(toDateInputValue(row.endDate))
    setExpiryError(null)
  }

  async function confirmSetExpiry() {
    if (!expiryTarget) return
    setExpiryError(null)
    setUpdatingExpiry(true)
    try {
      const form = new FormData()
      form.set("subscriptionId", expiryTarget.id)
      form.set("newEndDate", expiryDate)
      const result = await updateSubscriptionExpiryAction(form)
      if (result?.error) {
        setExpiryError(result.error)
      } else {
        setExpiryTarget(null)
        startTransition(() => router.refresh())
      }
    } catch (e) {
      setExpiryError(e instanceof Error ? e.message : "An unexpected error occurred.")
    } finally {
      setUpdatingExpiry(false)
    }
  }

  const today = toDateInputValue(new Date())

  return (
    <>
      <AdminTableShell>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className={adminTH}>User</th>
              <th className={adminTH}>Package</th>
              <th className={adminTH}>Start Date</th>
              <th className={adminTH}>Expiry Date</th>
              <th className={adminTHCenter}>Days Left</th>
              <th className={adminTHCenter}>Auto-Renew</th>
              <th className={adminTHCenter}>Status</th>
              <th className={adminTHCenter}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 ? (
              <AdminEmptyRow colSpan={8} message="No premium dealer subscriptions found." />
            ) : (
              subscriptions.map((row) => {
                const isActive = row.status === "active"
                const days = isActive ? daysRemaining(row.endDate) : null
                return (
                  <tr key={row.id} className={adminTR}>
                    <td className={adminTD}>
                      <div className="font-medium text-slate-800">{row.userName ?? "—"}</div>
                      <div className="text-xs text-slate-400">{row.userEmail ?? "—"}</div>
                    </td>
                    <td className={adminTD}>{row.packageName}</td>
                    <td className={adminTDMuted}>
                      {new Date(row.startDate).toLocaleDateString()}
                    </td>
                    <td className={adminTDMuted}>
                      {new Date(row.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-700">
                      {days != null ? days : "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">
                      {row.autoRenew ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <AdminStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      {isActive ? (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isPending}
                            onClick={() => openSetExpiry(row)}
                            className="h-7 gap-1 bg-blue-50 px-2.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200/60 hover:bg-blue-100 hover:text-blue-800"
                          >
                            <CalendarClock className="size-3.5" />
                            Set Expiry
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isPending}
                            onClick={() => openDeactivate(row.id)}
                            className="h-7 gap-1 bg-red-50 px-2.5 text-xs font-medium text-red-700 ring-1 ring-red-200/60 hover:bg-red-100 hover:text-red-800"
                          >
                            <Ban className="size-3.5" />
                            Deactivate
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </AdminTableShell>

      {/* Deactivate confirmation dialog */}
      <Dialog
        open={deactivateTarget !== null}
        onOpenChange={(v) => { if (!deactivating && !v) setDeactivateTarget(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Deactivate Subscription</DialogTitle>
            <DialogDescription>
              This will cancel the premium dealer subscription immediately. The user will lose
              premium dealer status and the subscription will be marked as cancelled.
            </DialogDescription>
          </DialogHeader>
          {deactivateError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">
              {deactivateError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeactivateTarget(null)}
              disabled={deactivating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmDeactivate}
              disabled={deactivating}
            >
              {deactivating ? "Deactivating…" : "Confirm Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set expiry date dialog */}
      <Dialog
        open={expiryTarget !== null}
        onOpenChange={(v) => { if (!updatingExpiry && !v) setExpiryTarget(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Set Expiry Date</DialogTitle>
            <DialogDescription>
              Update when this premium dealer subscription expires.
              Must be a future date.
            </DialogDescription>
          </DialogHeader>
          <input
            type="date"
            value={expiryDate}
            min={today}
            onChange={(e) => setExpiryDate(e.target.value)}
            disabled={updatingExpiry}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
          />
          {expiryError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">
              {expiryError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpiryTarget(null)}
              disabled={updatingExpiry}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={confirmSetExpiry}
              disabled={updatingExpiry || !expiryDate || expiryDate <= today}
            >
              {updatingExpiry ? "Saving…" : "Save Expiry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
