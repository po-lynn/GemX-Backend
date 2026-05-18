"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, XCircle, X, Copy, Check, RotateCcw } from "lucide-react"
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
import type { ColumnDef, ViewTab, FilterDef, GroupOption } from "@/components/admin/list-view"
import type { PointPurchaseRequestRow } from "@/features/points/db/points"
import {
  approvePointPurchaseRequestAction,
  rejectPointPurchaseRequestAction,
  resetPointPurchaseRequestAction,
  overrideApprovePointPurchaseRequestAction,
  overrideRejectPointPurchaseRequestAction,
} from "@/features/points/actions/points"

// ─── Helpers ──────────────────────────────────────────────

function fmtMMK(n: number): string {
  return n.toLocaleString("en-US")
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

function fmtRelative(d: Date): string {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60)        return "just now"
  if (diff < 3600)      return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)     return `${Math.floor(diff / 3600)}h ago`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`
  return fmtDate(d)
}

function getInitials(name: string | null): string {
  if (!name) return "?"
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
}

function getHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 6
  return h + 1
}

function getPkgTier(name: string): string {
  const n = name.toLowerCase()
  if (n.includes("elite") || n.includes("gold"))   return "elite"
  if (n.includes("pro") || n.includes("premium"))  return "pro"
  if (n.includes("trial") || n.includes("free"))   return "trial"
  if (n.includes("enterprise"))                     return "enterprise"
  return "basic"
}

function isMismatch(r: PointPurchaseRequestRow): boolean {
  return r.transferredAmount !== null && r.transferredAmount !== r.price
}

function isNameDiffers(r: PointPurchaseRequestRow): boolean {
  if (!r.transferredName || !r.userName) return false
  return r.transferredName.trim().toLowerCase() !== r.userName.trim().toLowerCase()
}

// ─── Copy chip with transient feedback ────────────────────

function CopyRefChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard?.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <span
      className="cpr-ref"
      title={copied ? "Copied!" : value}
      onClick={handleCopy}
      style={{ cursor: "pointer", position: "relative" }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </span>
      <span
        style={{
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          fontSize: 10.5,
          fontFamily: "inherit",
          color: copied ? "#047857" : undefined,
          transition: "color .15s",
        }}
      >
        {copied
          ? <><Check style={{ width: 11, height: 11 }} /> Copied</>
          : <Copy style={{ width: 11, height: 11, opacity: 0.45 }} />
        }
      </span>
    </span>
  )
}

// ─── Augmented row type ────────────────────────────────────

type Row = PointPurchaseRequestRow & {
  mismatch: boolean
  nameDiffers: boolean
  initials: string
  hue: number
  tier: string
}

// ─── Detail drawer ────────────────────────────────────────

function DetailDrawer({
  row,
  onClose,
  onApprove,
  onReject,
  onOverrideApprove,
  onOverrideReject,
  onReset,
  isPending,
}: {
  row: Row
  onClose: () => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onOverrideApprove: (id: string) => void
  onOverrideReject: (id: string) => void
  onReset: (id: string) => void
  isPending: boolean
}) {
  const diff = (row.transferredAmount ?? row.price) - row.price
  const match = !row.mismatch

  return (
    <>
      <div className="lv-drawer-backdrop" onClick={onClose} />
      <aside className="lv-drawer" role="dialog" aria-label="Purchase request detail">
        <header className="lv-drawer-head">
          <span className="lv-avatar" data-hue={row.hue}>{row.initials}</span>
          <div>
            <div className="lv-drawer-title">{row.userName ?? "Unknown"}</div>
            <div className="lv-drawer-sub">
              {row.id} · {row.packageName} · <StatusPill status={row.status} />
            </div>
          </div>
          <div className="lv-drawer-actions">
            <button className="lv-drawer-close" onClick={onClose} aria-label="Close">
              <X />
            </button>
          </div>
        </header>

        <div className="lv-drawer-body">
          <section className="lv-drawer-section">
            <h3 className="lv-drawer-section-h">Payment</h3>
            <div className="cpr-paycard">
              <div className="cpr-paycard-cell">
                <span className="cpr-paycard-label">Package price</span>
                <span className="cpr-paycard-value">MMK {fmtMMK(row.price)}</span>
              </div>
              <div className="cpr-paycard-cell cpr-paycard-cell-right">
                <span className="cpr-paycard-label">Amount transferred</span>
                <span className={`cpr-paycard-value ${match ? "match" : "mismatch"}`}>
                  MMK {row.transferredAmount != null ? fmtMMK(row.transferredAmount) : "—"}
                </span>
              </div>
              <div className={`cpr-paycard-foot ${match ? "match" : "mismatch"}`}>
                {match ? (
                  <><CheckCircle style={{ width: 13, height: 13 }} /> Amount matches package price</>
                ) : (
                  <><XCircle style={{ width: 13, height: 13 }} /> Amount mismatch — {diff > 0 ? "over by" : "short by"} <strong>MMK {fmtMMK(Math.abs(diff))}</strong></>
                )}
              </div>
            </div>

            <dl className="lv-kv">
              <dt>Points</dt>
              <dd className="lv-kv-mono">{fmtMMK(row.points)} pts</dd>
              <dt>Currency</dt>
              <dd>{row.currency.toUpperCase()}</dd>
              <dt>Reference</dt>
              <dd>
                {row.transactionReference
                  ? <CopyRefChip value={row.transactionReference} />
                  : <span style={{ color: "var(--lv-text-4)" }}>—</span>}
              </dd>
              <dt>Transfer name</dt>
              <dd>
                <span className="cpr-name">
                  <span className="cpr-name-text">{row.transferredName ?? "—"}</span>
                  {row.nameDiffers && <span className="cpr-name-warn">Differs</span>}
                </span>
              </dd>
            </dl>
          </section>

          {row.transferNote && (
            <section className="lv-drawer-section">
              <h3 className="lv-drawer-section-h">User note</h3>
              <div style={{
                padding: "10px 12px",
                background: "var(--lv-panel-2)",
                border: "1px solid var(--lv-border)",
                borderRadius: 8,
                fontSize: 13,
                color: "var(--lv-text-2)",
                lineHeight: 1.55,
              }}>
                {row.transferNote}
              </div>
            </section>
          )}

          <section className="lv-drawer-section">
            <h3 className="lv-drawer-section-h">Customer</h3>
            <dl className="lv-kv">
              <dt>Phone</dt>
              <dd className="lv-kv-mono">{row.userPhone ?? "—"}</dd>
              <dt>Email</dt>
              <dd className="lv-kv-mono">{row.userEmail ?? "—"}</dd>
            </dl>
          </section>

          <section className="lv-drawer-section">
            <h3 className="lv-drawer-section-h">Activity</h3>
            <div className="lv-timeline">
              <div className="lv-timeline-item">
                <span className="lv-timeline-dot" />
                <span className="lv-timeline-line" />
                <div className="lv-timeline-meta">
                  <span className="lv-timeline-title">Request submitted · {row.packageName}</span>
                  <span className="lv-timeline-when">{fmtDate(row.createdAt)}</span>
                </div>
              </div>
              {row.status === "approved" && row.reviewedAt && (
                <div className="lv-timeline-item">
                  <span className="lv-timeline-dot" style={{ background: "#047857" }} />
                  <div className="lv-timeline-meta">
                    <span className="lv-timeline-title">Approved · {fmtMMK(row.points)} pts credited</span>
                    <span className="lv-timeline-when">{fmtDate(row.reviewedAt)}</span>
                  </div>
                </div>
              )}
              {row.status === "rejected" && row.reviewedAt && (
                <div className="lv-timeline-item">
                  <span className="lv-timeline-dot" style={{ background: "var(--lv-danger)" }} />
                  <div className="lv-timeline-meta">
                    <span className="lv-timeline-title">Rejected</span>
                    <span className="lv-timeline-when">{fmtDate(row.reviewedAt)}</span>
                  </div>
                </div>
              )}
              {row.status === "pending" && (
                <div className="lv-timeline-item">
                  <span className="lv-timeline-dot" style={{ background: "var(--lv-accent)" }} />
                  <div className="lv-timeline-meta">
                    <span className="lv-timeline-title">Awaiting review</span>
                    <span className="lv-timeline-when">{fmtRelative(row.createdAt)}</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {row.adminNote && (
            <section className="lv-drawer-section">
              <h3 className="lv-drawer-section-h">Admin note</h3>
              <div style={{
                padding: "10px 12px",
                background: "var(--lv-panel-2)",
                border: "1px solid var(--lv-border)",
                borderRadius: 8,
                fontSize: 13,
                color: "var(--lv-text-2)",
                lineHeight: 1.55,
              }}>
                {row.adminNote}
              </div>
            </section>
          )}
        </div>

        <footer className="lv-drawer-foot">
          {row.status === "pending" && (
            <div className="cpr-decision">
              <button className="cpr-btn-reject" disabled={isPending} onClick={() => { onReject(row.id); onClose() }}>
                <XCircle style={{ width: 14, height: 14 }} /> Reject
              </button>
              <button className="cpr-btn-approve" disabled={isPending} onClick={() => { onApprove(row.id); onClose() }}>
                <CheckCircle style={{ width: 14, height: 14 }} /> Approve · Credit {fmtMMK(row.points)} pts
              </button>
            </div>
          )}
          {row.status === "approved" && (
            <div className="cpr-decision">
              <button className="cpr-btn-reject" disabled={isPending} onClick={() => { onOverrideReject(row.id); onClose() }}>
                <XCircle style={{ width: 14, height: 14 }} /> Change to Rejected
              </button>
              <button className="lv-rowbtn" disabled={isPending} onClick={() => { onReset(row.id); onClose() }} style={{ flex: 1, justifyContent: "center" }}>
                <RotateCcw style={{ width: 13, height: 13 }} /> Revert to Pending
              </button>
            </div>
          )}
          {row.status === "rejected" && (
            <div className="cpr-decision">
              <button className="lv-rowbtn" disabled={isPending} onClick={() => { onReset(row.id); onClose() }} style={{ flex: 1, justifyContent: "center" }}>
                <RotateCcw style={{ width: 13, height: 13 }} /> Revert to Pending
              </button>
              <button className="cpr-btn-approve" disabled={isPending} onClick={() => { onOverrideApprove(row.id); onClose() }}>
                <CheckCircle style={{ width: 14, height: 14 }} /> Change to Approved
              </button>
            </div>
          )}
        </footer>
      </aside>
    </>
  )
}

// ─── Main component ───────────────────────────────────────

const BASE = "/admin/credit/purchase-requests"

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
  requests: PointPurchaseRequestRow[]
  views?: ViewTab[]
  activeView?: string
  page: number
  pageSize: number
  total: number
}

export function PointPurchaseRequestsTable({
  requests,
  views,
  activeView,
  page,
  pageSize,
  total,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectNote, setRejectNote]     = useState("")
  const [rejectError, setRejectError]   = useState<string | null>(null)
  const [rejecting, setRejecting]       = useState(false)

  // Bulk action state
  const [bulkRejectIds, setBulkRejectIds]   = useState<string[]>([])
  const [bulkRejectNote, setBulkRejectNote] = useState("")
  const [bulkRejectError, setBulkRejectError] = useState<string | null>(null)
  const [bulkRejecting, setBulkRejecting]   = useState(false)
  const [bulkApproving, setBulkApproving]   = useState(false)

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
        startTransition(() => router.refresh())
      }
    } catch (e) {
      setRejectError(e instanceof Error ? e.message : "An unexpected error occurred.")
    } finally {
      setRejecting(false)
    }
  }

  function resetToPending(requestId: string) {
    const form = new FormData()
    form.set("requestId", requestId)
    startTransition(async () => {
      await resetPointPurchaseRequestAction(form)
      router.refresh()
    })
  }

  function overrideApprove(requestId: string) {
    const form = new FormData()
    form.set("requestId", requestId)
    startTransition(async () => {
      await overrideApprovePointPurchaseRequestAction(form)
      router.refresh()
    })
  }

  function overrideReject(requestId: string) {
    const form = new FormData()
    form.set("requestId", requestId)
    startTransition(async () => {
      await overrideRejectPointPurchaseRequestAction(form)
      router.refresh()
    })
  }

  async function bulkApprove(selectedRows: Row[]) {
    const pending = selectedRows.filter((r) => r.status === "pending")
    if (!pending.length) return
    setBulkApproving(true)
    try {
      for (const r of pending) {
        const form = new FormData()
        form.set("requestId", r.id)
        await approvePointPurchaseRequestAction(form)
      }
      startTransition(() => router.refresh())
    } finally {
      setBulkApproving(false)
    }
  }

  function openBulkReject(selectedRows: Row[]) {
    const pending = selectedRows.filter((r) => r.status === "pending")
    if (!pending.length) return
    setBulkRejectIds(pending.map((r) => r.id))
    setBulkRejectNote("")
    setBulkRejectError(null)
  }

  async function confirmBulkReject() {
    if (!bulkRejectIds.length) return
    setBulkRejectError(null)
    setBulkRejecting(true)
    try {
      for (const id of bulkRejectIds) {
        const form = new FormData()
        form.set("requestId", id)
        if (bulkRejectNote.trim()) form.set("adminNote", bulkRejectNote.trim())
        await rejectPointPurchaseRequestAction(form)
      }
      setBulkRejectIds([])
      startTransition(() => router.refresh())
    } catch (e) {
      setBulkRejectError(e instanceof Error ? e.message : "An unexpected error occurred.")
    } finally {
      setBulkRejecting(false)
    }
  }

  // Augment rows
  const rows: Row[] = requests.map((r) => ({
    ...r,
    mismatch:    isMismatch(r),
    nameDiffers: isNameDiffers(r),
    initials:    getInitials(r.userName),
    hue:         getHue(r.userId),
    tier:        getPkgTier(r.packageName),
  }))

  // Collect unique package names for filter
  const pkgNames = Array.from(new Set(requests.map((r) => r.packageName))).sort()

  const columnDefs: ColumnDef<Row>[] = [
    {
      id: "user",
      label: "User",
      width: 240,
      sortable: true,
      render: (r) => (
        <div className="lv-cell-user">
          <span className="lv-avatar" data-hue={r.hue}>{r.initials}</span>
          <div className="lv-cell-user-meta">
            <span className="lv-cell-name">{r.userName ?? "—"}</span>
            <span className="lv-cell-sub">{r.userPhone ?? r.userEmail ?? "—"}</span>
          </div>
        </div>
      ),
    },
    {
      id: "package",
      label: "Package",
      width: 160,
      sortable: true,
      render: (r) => (
        <span className="lv-pkg">
          <span className="lv-pkg-swatch" data-tier={r.tier}>{r.packageName[0]}</span>
          <span className="lv-pkg-name">{r.packageName}</span>
        </span>
      ),
    },
    {
      id: "points",
      label: "Points",
      width: 90,
      sortable: true,
      align: "right",
      render: (r) => <span className="lv-cell-mono">{fmtMMK(r.points)}</span>,
    },
    {
      id: "price",
      label: "Price",
      width: 120,
      sortable: true,
      align: "right",
      render: (r) => (
        <span className="lv-cell-mono">
          MMK {fmtMMK(r.price)}
        </span>
      ),
    },
    {
      id: "transferred",
      label: "Transferred",
      width: 140,
      sortable: true,
      align: "right",
      render: (r) => {
        if (r.transferredAmount == null) {
          return <span style={{ color: "var(--lv-text-4)", fontSize: 13 }}>—</span>
        }
        const diff = r.transferredAmount - r.price
        return (
          <span className={`cpr-amount${r.mismatch ? " mismatch" : ""}`}>
            <span className="cpr-amount-main">MMK {fmtMMK(r.transferredAmount)}</span>
            {r.mismatch && (
              <span className="cpr-amount-sub">
                {diff > 0 ? "+" : ""}{fmtMMK(diff)} vs price
              </span>
            )}
          </span>
        )
      },
    },
    {
      id: "transferName",
      label: "Transfer Name",
      width: 170,
      sortable: true,
      render: (r) => (
        <span className="cpr-name">
          <span className="cpr-name-text">{r.transferredName ?? "—"}</span>
          {r.nameDiffers && <span className="cpr-name-warn">Differs</span>}
        </span>
      ),
    },
    {
      id: "reference",
      label: "Reference",
      width: 170,
      sortable: true,
      render: (r) => r.transactionReference
        ? <CopyRefChip value={r.transactionReference} />
        : <span style={{ color: "var(--lv-text-4)", fontSize: 12 }}>—</span>,
    },
    {
      id: "note",
      label: "Note",
      width: 180,
      sortable: false,
      render: (r) => r.transferNote ? (
        <span className="cpr-note" title={r.transferNote}>{r.transferNote}</span>
      ) : (
        <span className="cpr-note empty">—</span>
      ),
    },
    {
      id: "status",
      label: "Status",
      width: 110,
      sortable: true,
      render: (r) => <StatusPill status={r.status} />,
    },
    {
      id: "createdAt",
      label: "Date",
      width: 140,
      sortable: true,
      render: (r) => (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
          <span style={{ fontSize: 12.5, color: "var(--lv-text)", fontVariantNumeric: "tabular-nums" }}>
            {fmtDate(r.createdAt)}
          </span>
          <span style={{ fontSize: 10.5, color: "var(--lv-text-3)" }}>
            {fmtRelative(r.createdAt)}
          </span>
        </div>
      ),
    },
  ]

  const filterDefs: FilterDef[] = [
    {
      id: "package",
      label: "Package",
      type: "multi",
      options: pkgNames.map((n) => ({
        value: n,
        label: n,
        count: requests.filter((r) => r.packageName === n).length,
      })),
    },
    {
      id: "flags",
      label: "Flags",
      type: "multi",
      options: [
        { value: "mismatch",  label: "Amount mismatch", count: rows.filter((r) => r.mismatch).length },
        { value: "nameDiff",  label: "Name differs",    count: rows.filter((r) => r.nameDiffers).length },
        { value: "hasNote",   label: "Has note",        count: rows.filter((r) => !!r.transferNote).length },
      ],
    },
    { id: "createdAt", label: "Date", type: "daterange" },
  ]

  const groupOptions: GroupOption[] = [
    { id: "package",        label: "Package" },
    { id: "status",         label: "Status" },
    { id: "createdAt:day",  label: "Date · Day" },
    { id: "createdAt:month",label: "Date · Month" },
    { id: "createdAt:year", label: "Date · Year" },
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
        getGroupKey={(r, grp) => {
          const d = new Date(r.createdAt)
          if (grp === "createdAt:day")   return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
          if (grp === "createdAt:month") return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
          if (grp === "createdAt:year")  return String(d.getFullYear())
          return null
        }}
        filterRow={(r, filterId, vals) => {
          if (filterId === "flags") {
            return vals.every((f) =>
              (f === "mismatch" && r.mismatch) ||
              (f === "nameDiff" && r.nameDiffers) ||
              (f === "hasNote" && !!r.transferNote)
            )
          }
          if (filterId === "package") {
            return vals.includes(r.packageName)
          }
          if (filterId === "createdAt") {
            const from = vals.find((v) => v.startsWith("from:"))?.substring(5)
            const to   = vals.find((v) => v.startsWith("to:"))?.substring(3)
            const d = new Date(r.createdAt)
            if (from && d < new Date(from + "T00:00:00")) return false
            if (to   && d > new Date(to   + "T23:59:59")) return false
            return true
          }
          return null
        }}
        defaultSort={{ id: "createdAt", dir: "desc" }}
        getSortValue={(r, colId) => {
          switch (colId) {
            case "user":         return r.userName ?? ""
            case "package":      return r.packageName
            case "points":       return r.points
            case "price":        return r.price
            case "transferred":  return r.transferredAmount ?? 0
            case "transferName": return r.transferredName ?? ""
            case "reference":    return r.transactionReference ?? ""
            case "status":       return r.status
            case "createdAt":    return r.createdAt.getTime()
            default:             return ""
          }
        }}
        rowActions={(r) => {
          if (r.status === "pending") return (
            <>
              <button className="lv-rowbtn approve" disabled={isPending} onClick={() => approve(r.id)} title="Approve">
                <CheckCircle style={{ width: 13, height: 13 }} /> Approve
              </button>
              <button className="lv-rowbtn reject" disabled={isPending} onClick={() => openReject(r.id)} title="Reject">
                <XCircle style={{ width: 13, height: 13 }} /> Reject
              </button>
            </>
          )
          if (r.status === "approved") return (
            <>
              <button className="lv-rowbtn reject" disabled={isPending} onClick={() => overrideReject(r.id)} title="Change to rejected">
                <XCircle style={{ width: 13, height: 13 }} /> Reject
              </button>
              <button className="lv-rowbtn" disabled={isPending} onClick={() => resetToPending(r.id)} title="Revert to pending">
                <RotateCcw style={{ width: 13, height: 13 }} /> Revert
              </button>
            </>
          )
          if (r.status === "rejected") return (
            <>
              <button className="lv-rowbtn approve" disabled={isPending} onClick={() => overrideApprove(r.id)} title="Change to approved">
                <CheckCircle style={{ width: 13, height: 13 }} /> Approve
              </button>
              <button className="lv-rowbtn" disabled={isPending} onClick={() => resetToPending(r.id)} title="Revert to pending">
                <RotateCcw style={{ width: 13, height: 13 }} /> Revert
              </button>
            </>
          )
          return <span style={{ color: "var(--lv-text-4)", fontSize: 12 }}>—</span>
        }}
        renderDrawer={(r, onClose) => (
          <DetailDrawer
            row={r}
            onClose={onClose}
            onApprove={approve}
            onReject={openReject}
            onOverrideApprove={overrideApprove}
            onOverrideReject={overrideReject}
            onReset={resetToPending}
            isPending={isPending}
          />
        )}
        renderBulkActions={(selectedRows, onClear) => {
          const pendingCount = selectedRows.filter((r) => r.status === "pending").length
          return (
            <>
              {pendingCount > 0 && (
                <>
                  <button
                    className="lv-bulkbtn approve"
                    disabled={bulkApproving || isPending}
                    onClick={() => { bulkApprove(selectedRows).then(onClear) }}
                  >
                    <CheckCircle style={{ width: 13, height: 13 }} />
                    {bulkApproving ? "Approving…" : `Approve ${pendingCount} pending`}
                  </button>
                  <button
                    className="lv-bulkbtn reject"
                    disabled={bulkRejecting || isPending}
                    onClick={() => openBulkReject(selectedRows)}
                  >
                    <XCircle style={{ width: 13, height: 13 }} />
                    {`Reject ${pendingCount} pending`}
                  </button>
                </>
              )}
              <button className="lv-bulkbtn" onClick={onClear}>
                Clear selection
              </button>
            </>
          )
        }}
        page={page}
        pageSize={pageSize}
        total={total}
        buildPageHref={(p) => buildPageHref(p, activeView ?? "all")}
        emptyMessage="No purchase requests found. Try adjusting your filters."
      />

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(v) => { if (!rejecting && !v) setRejectTarget(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Reject Purchase Request</DialogTitle>
            <DialogDescription>
              Optionally provide a reason. The request will be marked as rejected and the user
              will not receive points.
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

      {/* Bulk reject dialog */}
      <Dialog
        open={bulkRejectIds.length > 0}
        onOpenChange={(v) => { if (!bulkRejecting && !v) setBulkRejectIds([]) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">
              Reject {bulkRejectIds.length} Request{bulkRejectIds.length !== 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              All selected pending requests will be rejected and the users will not receive points.
              Optionally provide a shared rejection reason.
            </DialogDescription>
          </DialogHeader>
          <textarea
            placeholder="Rejection reason (optional)"
            value={bulkRejectNote}
            onChange={(e) => setBulkRejectNote(e.target.value)}
            rows={3}
            disabled={bulkRejecting}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
          />
          {bulkRejectError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">
              {bulkRejectError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkRejectIds([])}
              disabled={bulkRejecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmBulkReject}
              disabled={bulkRejecting}
            >
              {bulkRejecting
                ? "Rejecting…"
                : `Confirm Reject ${bulkRejectIds.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
