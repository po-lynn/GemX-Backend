"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CalendarClock, Ban, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ListViewCard } from "@/components/admin/list-view"
import { StatusPill } from "@/components/admin/list-view/StatusPill"
import { DaysRing } from "@/components/admin/list-view/DaysRing"
import type { ColumnDef, ViewTab, FilterDef, GroupOption } from "@/components/admin/list-view"
import type { PremiumDealerSubscriptionRow } from "@/features/points/db/points"
import {
  deactivatePremiumDealerAction,
  updateSubscriptionExpiryAction,
} from "@/features/points/actions/points"

// ─── Helpers ──────────────────────────────────────────────
function daysRemaining(endDate: Date): number {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function toDateInputValue(date: Date): string {
  return new Date(date).toISOString().slice(0, 10)
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function getInitials(name: string | null): string {
  if (!name) return "?"
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

function getHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 6
  return h + 1
}

function getPkgTier(name: string): string {
  const n = name.toLowerCase()
  if (n.includes("elite") || n.includes("gold")) return "elite"
  if (n.includes("pro") || n.includes("premium")) return "pro"
  if (n.includes("trial") || n.includes("free")) return "trial"
  if (n.includes("enterprise")) return "enterprise"
  return "basic"
}

/**
 * Group key resolver for the ListViewCard "Group by" control.
 * Returns a display key for the "user" grouping (name with email to
 * disambiguate same-named users); null falls back to the default
 * string lookup for other group ids (status, packageName).
 * Exported for unit testing.
 */
export function subscriptionGroupKey(
  row: Pick<PremiumDealerSubscriptionRow, "userName" | "userEmail">,
  groupBy: string
): string | null {
  if (groupBy !== "user") return null
  if (row.userName && row.userEmail) return `${row.userName} (${row.userEmail})`
  return row.userName ?? row.userEmail ?? "Unknown user"
}

// ─── Row type extended with derived fields ─────────────────
type Row = PremiumDealerSubscriptionRow & {
  daysLeft: number
  tier: string
  initials: string
  hue: number
}

// ─── Detail drawer ────────────────────────────────────────
function DetailDrawer({
  row,
  onClose,
  onDeactivate,
  onSetExpiry,
  isPending,
}: {
  row: Row
  onClose: () => void
  onDeactivate: (id: string) => void
  onSetExpiry: (row: Row) => void
  isPending: boolean
}) {
  return (
    <>
      <div className="lv-drawer-backdrop" onClick={onClose} />
      <aside className="lv-drawer" role="dialog" aria-label="Subscription detail">
        <header className="lv-drawer-head">
          <span className="lv-avatar" data-hue={row.hue}>
            {row.initials}
          </span>
          <div>
            <Link href={`/admin/users/${row.userId}/edit?page=1`} className="lv-drawer-title hover:underline">
              {row.userName ?? "Unknown"}
            </Link>
            <div className="lv-drawer-sub">{row.userEmail ?? "—"}</div>
          </div>
          <div className="lv-drawer-actions">
            <button className="lv-drawer-close" onClick={onClose} aria-label="Close">
              <X />
            </button>
          </div>
        </header>

        <div className="lv-drawer-body">
          <section>
            <h3 className="lv-drawer-section-h">Subscription</h3>
            <dl className="lv-kv">
              <dt>Seller name</dt>
              <dd>
                <Link href={`/admin/users/${row.userId}/edit?page=1`} className="hover:underline" style={{ color: "var(--lv-accent)" }}>
                  {row.userName ?? "—"}
                </Link>
              </dd>
              <dt>Package</dt>
              <dd>
                <span className="lv-pkg">
                  <span className="lv-pkg-swatch" data-tier={row.tier}>
                    {row.packageName[0]}
                  </span>
                  <span className="lv-pkg-name">{row.packageName}</span>
                </span>
              </dd>
              <dt>Status</dt>
              <dd><StatusPill status={row.status} /></dd>
              <dt>Start date</dt>
              <dd className="lv-kv-mono">{fmtDate(row.startDate)}</dd>
              <dt>Expiry date</dt>
              <dd className="lv-kv-mono">{fmtDate(row.endDate)}</dd>
              <dt>Days remaining</dt>
              <dd>
                {row.status === "active"
                  ? row.daysLeft < 0
                    ? <span style={{ color: "var(--lv-danger)" }}>Expired {Math.abs(row.daysLeft)}d ago</span>
                    : `${row.daysLeft} days`
                  : "—"}
              </dd>
              <dt>Auto-renew</dt>
              <dd>{row.autoRenew ? "Enabled" : "Disabled"}</dd>
            </dl>
          </section>

          <section>
            <h3 className="lv-drawer-section-h">Activity</h3>
            <div className="lv-timeline">
              <div className="lv-timeline-item">
                <span className="lv-timeline-dot" />
                <span className="lv-timeline-line" />
                <div className="lv-timeline-meta">
                  <span className="lv-timeline-title">Subscription started · {row.packageName}</span>
                  <span className="lv-timeline-when">{fmtDate(row.startDate)}</span>
                </div>
              </div>
              {row.status === "cancelled" && (
                <div className="lv-timeline-item">
                  <span className="lv-timeline-dot" style={{ background: "var(--lv-danger)" }} />
                  <div className="lv-timeline-meta">
                    <span className="lv-timeline-title">Subscription cancelled</span>
                    <span className="lv-timeline-when">{fmtDate(row.endDate)}</span>
                  </div>
                </div>
              )}
              {row.status === "expired" && (
                <div className="lv-timeline-item">
                  <span className="lv-timeline-dot" style={{ background: "var(--lv-warn)" }} />
                  <div className="lv-timeline-meta">
                    <span className="lv-timeline-title">Subscription expired</span>
                    <span className="lv-timeline-when">{fmtDate(row.endDate)}</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {row.status === "active" && (
          <footer className="lv-drawer-foot">
            <button
              className="lv-rowbtn"
              disabled={isPending}
              onClick={() => { onSetExpiry(row); onClose() }}
            >
              <CalendarClock style={{ width: 14, height: 14 }} /> Set Expiry
            </button>
            <button
              className="lv-rowbtn lv-danger"
              disabled={isPending}
              onClick={() => { onDeactivate(row.id); onClose() }}
            >
              <Ban style={{ width: 14, height: 14 }} /> Deactivate
            </button>
          </footer>
        )}
      </aside>
    </>
  )
}

// ─── Main component ───────────────────────────────────────
const BASE = "/admin/credit/premium-dealer-subscriptions"

function buildPageHref(page: number, status: string): string {
  const p = new URLSearchParams()
  p.set("page", String(page))
  if (status !== "all") p.set("status", status)
  return `${BASE}?${p.toString()}`
}

function buildViewHref(view: string): string {
  const p = new URLSearchParams()
  if (view !== "all") p.set("status", view)
  p.set("page", "1")
  return `${BASE}?${p.toString()}`
}

type Props = {
  subscriptions: PremiumDealerSubscriptionRow[]
  views?: ViewTab[]
  activeView?: string
  page: number
  pageSize: number
  total: number
}

export function PremiumDealerSubscriptionsTable({
  subscriptions,
  views,
  activeView,
  page,
  pageSize,
  total,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Deactivate dialog
  const [deactivateTarget, setDeactivateTarget] = useState<string | null>(null)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  // Set expiry dialog
  const [expiryTarget, setExpiryTarget] = useState<Row | null>(null)
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

  function openSetExpiry(row: Row) {
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

  // Augment rows with derived fields
  const rows: Row[] = subscriptions.map((s) => ({
    ...s,
    daysLeft: daysRemaining(s.endDate),
    tier: getPkgTier(s.packageName),
    initials: getInitials(s.userName),
    hue: getHue(s.userId),
  }))

  // Column definitions
  const columnDefs: ColumnDef<Row>[] = [
    {
      id: "user",
      label: "User",
      width: 260,
      sortable: true,
      render: (r) => (
        <div className="lv-cell-user">
          <span className="lv-avatar" data-hue={r.hue}>
            {r.initials}
          </span>
          <div className="lv-cell-user-meta">
            <span className="lv-cell-name">{r.userName ?? "—"}</span>
            <span className="lv-cell-sub">{r.userEmail ?? "—"}</span>
          </div>
        </div>
      ),
    },
    {
      id: "packageName",
      label: "Package",
      width: 160,
      sortable: true,
      render: (r) => (
        <span className="lv-pkg">
          <span className="lv-pkg-swatch" data-tier={r.tier}>
            {r.packageName[0]}
          </span>
          <span className="lv-pkg-name">{r.packageName}</span>
        </span>
      ),
    },
    {
      id: "startDate",
      label: "Start",
      width: 110,
      sortable: true,
      render: (r) => (
        <span className="lv-cell-mono">{fmtDate(r.startDate)}</span>
      ),
    },
    {
      id: "endDate",
      label: "Expiry",
      width: 110,
      sortable: true,
      render: (r) => (
        <span className="lv-cell-mono">{fmtDate(r.endDate)}</span>
      ),
    },
    {
      id: "daysLeft",
      label: "Days left",
      width: 110,
      sortable: true,
      render: (r) =>
        r.status === "active" ? (
          <DaysRing daysLeft={r.daysLeft} totalDays={365} />
        ) : (
          <span style={{ color: "var(--lv-text-4)", fontSize: 13 }}>—</span>
        ),
    },
    {
      id: "autoRenew",
      label: "Auto-renew",
      width: 110,
      sortable: true,
      render: (r) =>
        r.autoRenew ? (
          <span className="lv-status active" style={{ background: "var(--lv-accent-soft)", color: "var(--lv-accent)" }}>
            Yes
          </span>
        ) : (
          <span className="lv-status cancelled">No</span>
        ),
    },
    {
      id: "status",
      label: "Status",
      width: 110,
      sortable: true,
      render: (r) => <StatusPill status={r.status} />,
    },
  ]

  const filterDefs: FilterDef[] = [
    {
      id: "status",
      label: "Status",
      type: "multi",
      options: [
        { value: "active",    label: "Active" },
        { value: "expired",   label: "Expired" },
        { value: "cancelled", label: "Cancelled" },
        { value: "pending",   label: "Pending" },
      ],
    },
    {
      id: "autoRenew",
      label: "Auto-renew",
      type: "multi",
      options: [
        { value: "true",  label: "Enabled" },
        { value: "false", label: "Disabled" },
      ],
    },
  ]

  const groupOptions: GroupOption[] = [
    { id: "user",      label: "User" },
    { id: "status",    label: "Status" },
    { id: "packageName", label: "Package" },
  ]

  return (
    <>
      <ListViewCard
        rows={rows}
        columnDefs={columnDefs}
        views={views}
        activeView={activeView}
        buildViewHref={buildViewHref}
        filterDefs={filterDefs}
        groupOptions={groupOptions}
        getGroupKey={subscriptionGroupKey}
        defaultSort={{ id: "startDate", dir: "desc" }}
        getSortValue={(r, colId) => {
          switch (colId) {
            case "user":      return r.userName ?? ""
            case "packageName": return r.packageName
            case "startDate": return r.startDate.getTime()
            case "endDate":   return r.endDate.getTime()
            case "daysLeft":  return r.daysLeft
            case "autoRenew": return r.autoRenew ? 1 : 0
            case "status":    return r.status
            default:          return ""
          }
        }}
        rowActions={(r) =>
          r.status === "active" ? (
            <>
              <button
                className="lv-rowbtn"
                disabled={isPending}
                onClick={() => openSetExpiry(r)}
                title="Set expiry date"
              >
                <CalendarClock style={{ width: 13, height: 13 }} /> Set Expiry
              </button>
              <button
                className="lv-rowbtn lv-danger"
                disabled={isPending}
                onClick={() => openDeactivate(r.id)}
                title="Deactivate subscription"
              >
                <Ban style={{ width: 13, height: 13 }} /> Deactivate
              </button>
            </>
          ) : (
            <span style={{ color: "var(--lv-text-4)", fontSize: 12 }}>—</span>
          )
        }
        renderDrawer={(r, onClose) => (
          <DetailDrawer
            row={r}
            onClose={onClose}
            onDeactivate={openDeactivate}
            onSetExpiry={openSetExpiry}
            isPending={isPending}
          />
        )}
        renderBulkActions={(_selectedRows, onClear) => (
          <>
            <button
              className="lv-bulkbtn lv-bulk-danger"
              disabled={isPending}
              onClick={() => {
                // Bulk deactivate: deactivate first selected active one for now
                // Full bulk deactivate would loop through server actions
                onClear()
              }}
            >
              <Ban style={{ width: 13, height: 13 }} /> Deactivate selected
            </button>
          </>
        )}
        page={page}
        pageSize={pageSize}
        total={total}
        buildPageHref={(p) => buildPageHref(p, activeView ?? "all")}
        onExport={(fmt) => {
          // Export logic can be wired later
          console.log("Export as", fmt)
        }}
        emptyMessage="No premium dealer subscriptions found. Try adjusting your filters."
      />

      {/* Deactivate confirmation dialog */}
      <Dialog
        open={deactivateTarget !== null}
        onOpenChange={(v) => {
          if (!deactivating && !v) setDeactivateTarget(null)
        }}
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
        onOpenChange={(v) => {
          if (!updatingExpiry && !v) setExpiryTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Set Expiry Date</DialogTitle>
            <DialogDescription>
              Update when this premium dealer subscription expires. Must be a future date.
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
