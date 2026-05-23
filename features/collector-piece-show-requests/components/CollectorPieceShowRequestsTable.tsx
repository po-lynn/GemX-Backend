"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, X, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { ListViewCard } from "@/components/admin/list-view"
import { StatusPill } from "@/components/admin/list-view/StatusPill"
import type { ColumnDef, ViewTab, FilterDef, GroupOption } from "@/components/admin/list-view"
import type { CollectorPieceShowRequestRow } from "@/features/collector-piece-show-requests/db/collector-piece-show-requests"
import {
  approveCollectorPieceShowRequestAction,
  rejectCollectorPieceShowRequestAction,
} from "@/features/collector-piece-show-requests/actions/collector-piece-show-requests"
// ─── Helpers ──────────────────────────────────────────────

function fmtMMK(n: number): string {
  return n.toLocaleString("en-US")
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

function fmtRelative(d: Date | string): string {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60)         return "just now"
  if (diff < 3600)       return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)      return `${Math.floor(diff / 3600)}h ago`
  if (diff < 7 * 86400)  return `${Math.floor(diff / 86400)}d ago`
  return fmtDate(d)
}

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
}

function getHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 6
  return h + 1
}

function deriveTier(priceStr: string | null): "museum" | "investment" | "rare" | "standard" {
  const p = parseFloat(priceStr ?? "0")
  if (p >= 20_000_000) return "museum"
  if (p >= 8_000_000)  return "investment"
  if (p >= 2_000_000)  return "rare"
  return "standard"
}

function deriveTierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

function deriveIntent(msg: string | null): { score: number; label: "serious" | "curator" | "casual" } {
  if (!msg) return { score: 25, label: "casual" }
  const lower = msg.toLowerCase()
  if (/museum|acquisitions|article|research|curator|press credentials/.test(lower))
    return { score: 75, label: "curator" }
  if (/serious|private collection|references|investment|inspection|provenance|heirloom|anniversary|certificate|long.time client/.test(lower))
    return { score: 85, label: "serious" }
  if (/casual|browsing|caught my eye|better photos/.test(lower))
    return { score: 20, label: "casual" }
  return { score: 55, label: "serious" }
}

function isHighValue(priceStr: string | null): boolean {
  return parseFloat(priceStr ?? "0") >= 20_000_000
}

// ─── Augmented row type ────────────────────────────────────

type Row = CollectorPieceShowRequestRow & {
  initials: string
  hue: number
  tier: "museum" | "investment" | "rare" | "standard"
  intent: { score: number; label: "serious" | "curator" | "casual" }
  highValue: boolean
}

function augment(r: CollectorPieceShowRequestRow): Row {
  return {
    ...r,
    initials: getInitials(r.requester.name),
    hue: getHue(r.requester.name),
    tier: deriveTier(r.product.price),
    intent: deriveIntent(r.message),
    highValue: isHighValue(r.product.price),
  }
}

// ─── Detail drawer ─────────────────────────────────────────

function CollectorDrawer({
  row,
  onClose,
  onApprove,
  onReject,
  isPending,
}: {
  row: Row
  onClose: () => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  isPending: boolean
}) {
  return (
    <>
      <div className="lv-drawer-backdrop" onClick={onClose} />
      <aside className="lv-drawer" role="dialog" aria-label="Collector request detail">
        <header className="lv-drawer-head">
          <span className="lv-avatar" data-hue={row.hue}>{row.initials}</span>
          <div>
            <div className="lv-drawer-title">{row.requester.name}</div>
            <div className="lv-drawer-sub" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono,monospace)", fontSize: 11 }}>{row.id.slice(0, 8)}…</span>
              <span>·</span>
              <StatusPill status={row.status} />
              {row.highValue && <span className="cr-pri-pill">High value</span>}
            </div>
          </div>
          <div className="lv-drawer-actions">
            <button className="lv-drawer-close" onClick={onClose} aria-label="Close">
              <X />
            </button>
          </div>
        </header>

        <div className="lv-drawer-body">

          {/* Piece preview card */}
          <section className="lv-drawer-section">
            <h3 className="lv-drawer-section-h">Requested piece</h3>
            <div className="cr-piececard">
              <div className="cr-piececard-preview" data-tier={row.tier}>
                <svg className="cr-piececard-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 10 12 3l6 7-6 11z" />
                  <path d="M6 10h12M12 3v18" />
                </svg>
                <span className="cr-piececard-tier">{row.tier}</span>
              </div>
              <div className="cr-piececard-meta">
                <div className="cr-piececard-name">
                  {row.product.title}
                  {row.highValue && <span className="cr-hv-pill">High value</span>}
                </div>
                <div className="cr-piececard-sub">
                  {row.product.categoryName ?? row.product.productType.replace("_", " ")}
                  {row.product.sku && <> · {row.product.sku}</>}
                </div>
                {row.product.price && (
                  <div className="cr-piececard-price">
                    MMK {fmtMMK(parseFloat(row.product.price))}
                  </div>
                )}
                <div className="cr-piececard-actions">
                  <Link
                    href={`/admin/products/${row.productId}/edit?from=collector-requests`}
                    className="lv-rowbtn"
                    style={{ textDecoration: "none" }}
                  >
                    <ExternalLink style={{ width: 12, height: 12 }} /> Open in catalogue
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Message card */}
          {row.message && (
            <section className="lv-drawer-section">
              <h3 className="lv-drawer-section-h">Message</h3>
              <div className="cr-msgcard">
                <div className="cr-msgcard-head">
                  <span className={`cr-intent-tag intent-${row.intent.label}`}>
                    {row.intent.label.charAt(0).toUpperCase() + row.intent.label.slice(1)}
                  </span>
                  <span className="cr-msgcard-meta">
                    Intent score · <strong>{row.intent.score}/100</strong>
                  </span>
                </div>
                <p className="cr-msgcard-body">{row.message}</p>
                <div className="cr-msgcard-foot">
                  <span>{fmtDate(row.createdAt)}</span>
                </div>
              </div>
            </section>
          )}

          {/* Collector profile */}
          <section className="lv-drawer-section">
            <h3 className="lv-drawer-section-h">Collector profile</h3>
            <dl className="lv-kv">
              <dt>Name</dt>
              <dd>
                <Link href={`/admin/users/${row.userId}/edit`} style={{ color: "var(--lv-accent)", textDecoration: "none", fontWeight: 600 }}>
                  {row.requester.name}
                </Link>
              </dd>
              <dt>Email</dt>
              <dd className="lv-kv-mono">{row.requester.email}</dd>
              {row.requester.phone && (
                <>
                  <dt>Phone</dt>
                  <dd className="lv-kv-mono">{row.requester.phone}</dd>
                </>
              )}
              <dt>Product state</dt>
              <dd>
                <span className={`cr-piece-state ${row.product.status}`}>{row.product.status}</span>
              </dd>
            </dl>
          </section>

          {/* Activity */}
          <section className="lv-drawer-section">
            <h3 className="lv-drawer-section-h">Activity</h3>
            <div className="lv-timeline">
              <div className="lv-timeline-item">
                <span className="lv-timeline-dot" />
                <span className="lv-timeline-line" />
                <div className="lv-timeline-meta">
                  <span className="lv-timeline-title">Request submitted</span>
                  <span className="lv-timeline-when">{fmtDate(row.createdAt)}</span>
                </div>
              </div>
              {row.status === "approved" && (
                <div className="lv-timeline-item">
                  <span className="lv-timeline-dot" style={{ background: "#047857" }} />
                  <div className="lv-timeline-meta">
                    <span className="lv-timeline-title">Approved · access granted</span>
                    <span className="lv-timeline-when" style={{ color: "#047857" }}>Completed</span>
                  </div>
                </div>
              )}
              {row.status === "rejected" && (
                <div className="lv-timeline-item">
                  <span className="lv-timeline-dot" style={{ background: "#B91C1C" }} />
                  <div className="lv-timeline-meta">
                    <span className="lv-timeline-title">Rejected</span>
                    <span className="lv-timeline-when" style={{ color: "#B91C1C" }}>Closed</span>
                  </div>
                </div>
              )}
              {row.status === "pending" && (
                <div className="lv-timeline-item">
                  <span className="lv-timeline-dot" style={{ background: "#D97706" }} />
                  <div className="lv-timeline-meta">
                    <span className="lv-timeline-title">Awaiting decision</span>
                    <span className="lv-timeline-when">{fmtRelative(row.createdAt)}</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="lv-drawer-foot">
          {row.status === "pending" ? (
            <div className="cr-decision">
              <button
                className="cr-btn-reject"
                disabled={isPending}
                onClick={() => onReject(row.id)}
              >
                <X style={{ width: 14, height: 14 }} /> Reject
              </button>
              <button
                className="cr-btn-approve"
                disabled={isPending}
                onClick={() => onApprove(row.id)}
              >
                <Check style={{ width: 14, height: 14 }} /> Approve · Grant access
              </button>
            </div>
          ) : (
            <Link
              href={`/admin/users/${row.userId}/edit`}
              className="lv-export-btn"
              style={{ textDecoration: "none" }}
            >
              <ExternalLink style={{ width: 14, height: 14 }} /> View collector profile
            </Link>
          )}
        </footer>
      </aside>
    </>
  )
}

// ─── Main component ────────────────────────────────────────

const BASE = "/admin/collector-piece-show-requests"

function buildViewHref(view: string): string {
  const p = new URLSearchParams()
  if (view !== "all") p.set("view", view)
  p.set("page", "1")
  return `${BASE}?${p.toString()}`
}

function buildPageHref(page: number, view: string): string {
  const p = new URLSearchParams()
  if (view !== "all") p.set("view", view)
  p.set("page", String(page))
  return `${BASE}?${p.toString()}`
}

type Props = {
  requests: CollectorPieceShowRequestRow[]
  views: ViewTab[]
  activeView: string
  page: number
  pageSize: number
  total: number
}

export function CollectorPieceShowRequestsTable({
  requests,
  views,
  activeView,
  page,
  pageSize,
  total,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const rows: Row[] = requests.map(augment)

  // ── Column defs ──────────────────────────────────────────
  const columnDefs: ColumnDef<Row>[] = [
    {
      id: "piece",
      label: "Piece",
      width: 260,
      sortable: true,
      render: (r) => (
        <div className="cr-cell-piece">
          <span className="cr-piece-thumb" data-tier={r.tier}>
            <span className="cr-piece-thumb-glyph">{r.product.title[0]}</span>
          </span>
          <div className="cr-piece-meta">
            <span className="cr-piece-name">
              {r.product.title}
              {r.highValue && <span className="cr-hv-dot" title="High-value piece" />}
            </span>
            <span className="cr-piece-sub">
              {r.product.sku && <><span className="cr-piece-sku">{r.product.sku}</span><span className="cr-piece-sep">·</span></>}
              <span className={`cr-piece-state ${r.product.status}`}>{r.product.status}</span>
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "category",
      label: "Category",
      width: 120,
      sortable: true,
      toggleable: true,
      render: (r) =>
        r.product.categoryName
          ? <span className="cr-category">{r.product.categoryName}</span>
          : <span style={{ fontSize: 12.5, color: "var(--lv-text-4)" }}>—</span>,
    },
    {
      id: "value",
      label: "Listed Value",
      width: 130,
      sortable: true,
      align: "right",
      render: (r) => (
        <span className={`cr-value ${r.tier}`}>
          <span className="cr-value-main">
            {r.product.price ? `MMK ${fmtMMK(parseFloat(r.product.price))}` : "—"}
          </span>
          <span className="cr-value-tier">{deriveTierLabel(r.tier)}</span>
        </span>
      ),
    },
    {
      id: "requester",
      label: "Requester",
      width: 220,
      sortable: true,
      render: (r) => (
        <div className="lv-cell-user">
          <span className="lv-avatar" data-hue={r.hue}>{r.initials}</span>
          <div className="lv-cell-user-meta">
            <span className="lv-cell-name">
              <Link
                href={`/admin/users/${r.userId}/edit`}
                onClick={(e) => e.stopPropagation()}
                style={{ color: "var(--lv-accent)", textDecoration: "none", fontWeight: 600 }}
              >
                {r.requester.name}
              </Link>
            </span>
            <span className="lv-cell-sub">{r.requester.phone ?? r.requester.email}</span>
          </div>
        </div>
      ),
    },
    {
      id: "message",
      label: "Message",
      width: 280,
      flex: true,
      sortable: false,
      render: (r) =>
        r.message ? (
          <span className="cr-message">
            <span className={`cr-intent-tag intent-${r.intent.label}`}>
              {r.intent.label.charAt(0).toUpperCase() + r.intent.label.slice(1)}
            </span>
            <span className="cr-message-text" title={r.message}>{r.message}</span>
          </span>
        ) : (
          <span style={{ fontSize: 12.5, color: "var(--lv-text-4)", fontStyle: "italic" }}>No message</span>
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
      label: "Created",
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

  // ── Filter defs ──────────────────────────────────────────
  const tiers = ["museum", "investment", "rare", "standard"] as const
  const categories = [...new Set(rows.map((r) => r.product.categoryName).filter(Boolean) as string[])]

  const filterDefs: FilterDef[] = [
    {
      id: "tier",
      label: "Tier",
      type: "multi",
      options: tiers.map((t) => ({
        value: t,
        label: deriveTierLabel(t),
        count: rows.filter((r) => r.tier === t).length,
      })),
    },
    ...(categories.length > 0
      ? [{
          id: "category",
          label: "Category",
          type: "multi" as const,
          options: categories.map((c) => ({
            value: c,
            label: c,
            count: rows.filter((r) => r.product.categoryName === c).length,
          })),
        }]
      : []),
    {
      id: "pieceStatus",
      label: "Piece state",
      type: "multi",
      options: [
        { value: "active",  label: "Active",   count: rows.filter((r) => r.product.status === "active").length },
        { value: "archive", label: "Archived",  count: rows.filter((r) => r.product.status === "archive").length },
      ],
    },
    { id: "createdAt", label: "Date", type: "daterange" },
  ]

  // ── Group options ────────────────────────────────────────
  const groupOptions: GroupOption[] = [
    { id: "tier",     label: "Tier" },
    { id: "category", label: "Category" },
    { id: "status",   label: "Status" },
  ]

  // ── Custom filter row ────────────────────────────────────
  function filterRow(r: Row, filterId: string, vals: string[]): boolean | null {
    if (filterId === "tier")        return vals.includes(r.tier)
    if (filterId === "category")    return vals.includes(r.product.categoryName ?? "")
    if (filterId === "pieceStatus") return vals.includes(r.product.status)
    if (filterId === "createdAt") {
      const from = vals.find((v) => v.startsWith("from:"))?.slice(5)
      const to   = vals.find((v) => v.startsWith("to:"))?.slice(3)
      const d = new Date(r.createdAt).getTime()
      if (from && d < new Date(from + "T00:00:00").getTime()) return false
      if (to   && d > new Date(to   + "T23:59:59").getTime()) return false
      return true
    }
    return null
  }

  // ── Custom sort value ────────────────────────────────────
  function getSortValue(r: Row, colId: string): string | number {
    switch (colId) {
      case "piece":     return r.product.title
      case "category":  return r.product.categoryName ?? ""
      case "value":     return parseFloat(r.product.price ?? "0")
      case "requester": return r.requester.name
      case "status":    return r.status
      case "createdAt": return new Date(r.createdAt).getTime()
      default: return ""
    }
  }

  // ── Custom group key ─────────────────────────────────────
  function getGroupKey(r: Row, by: string): string | null {
    if (by === "tier")     return deriveTierLabel(r.tier)
    if (by === "category") return r.product.categoryName ?? "Uncategorised"
    if (by === "status")   return r.status
    return null
  }

  // ── Actions ──────────────────────────────────────────────
  function approve(requestId: string) {
    const form = new FormData()
    form.set("requestId", requestId)
    startTransition(async () => {
      const result = await approveCollectorPieceShowRequestAction(form)
      if (result?.error) {
        toast.error("Failed to approve", { description: result.error })
        return
      }
      toast.success("Request approved", { description: "Collector access has been granted." })
      router.refresh()
    })
  }

  function reject(requestId: string) {
    const form = new FormData()
    form.set("requestId", requestId)
    startTransition(async () => {
      const result = await rejectCollectorPieceShowRequestAction(form)
      if (result?.error) {
        toast.error("Failed to reject", { description: result.error })
        return
      }
      toast.success("Request rejected", { description: "The collector has been notified." })
      router.refresh()
    })
  }

  // ── Row actions ──────────────────────────────────────────
  function rowActions(r: Row, disabled: boolean) {
    if (r.status === "pending") {
      return (
        <>
          <button
            className="lv-rowbtn approve"
            title="Approve viewing request"
            disabled={disabled || isPending}
            onClick={(e) => { e.stopPropagation(); approve(r.id) }}
          >
            <Check style={{ width: 12, height: 12 }} /> Approve
          </button>
          <button
            className="lv-rowbtn reject"
            title="Reject"
            disabled={disabled || isPending}
            onClick={(e) => { e.stopPropagation(); reject(r.id) }}
          >
            <X style={{ width: 12, height: 12 }} /> Reject
          </button>
        </>
      )
    }
    return (
      <Link
        href={`/admin/products/${r.productId}/edit?from=collector-requests`}
        className="lv-rowbtn"
        onClick={(e) => e.stopPropagation()}
        style={{ textDecoration: "none" }}
      >
        <ExternalLink style={{ width: 12, height: 12 }} /> Open piece
      </Link>
    )
  }

  // ── Bulk actions ─────────────────────────────────────────
  function renderBulkActions(selectedRows: Row[], onClear: () => void) {
    const pendingRows = selectedRows.filter((r) => r.status === "pending")
    return (
      <>
        {pendingRows.length > 0 && (
          <button
            className="lv-bulkbtn approve"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                for (const r of pendingRows) {
                  const form = new FormData()
                  form.set("requestId", r.id)
                  await approveCollectorPieceShowRequestAction(form)
                }
                toast.success(`${pendingRows.length} request${pendingRows.length !== 1 ? "s" : ""} approved`, {
                  description: "Collector access has been granted.",
                })
                onClear()
                router.refresh()
              })
            }}
          >
            <Check style={{ width: 13, height: 13 }} />
            Approve {pendingRows.length > 1 ? `${pendingRows.length} ` : ""}pending
          </button>
        )}
        {pendingRows.length > 0 && (
          <button
            className="lv-bulkbtn danger"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                for (const r of pendingRows) {
                  const form = new FormData()
                  form.set("requestId", r.id)
                  await rejectCollectorPieceShowRequestAction(form)
                }
                toast.success(`${pendingRows.length} request${pendingRows.length !== 1 ? "s" : ""} rejected`)
                onClear()
                router.refresh()
              })
            }}
          >
            <X style={{ width: 13, height: 13 }} />
            Reject {pendingRows.length > 1 ? `${pendingRows.length} ` : ""}pending
          </button>
        )}
      </>
    )
  }

  return (
    <ListViewCard
      rows={rows}
      columnDefs={columnDefs}
      views={views}
      activeView={activeView}
      buildViewHref={buildViewHref}
      filterDefs={filterDefs}
      groupOptions={groupOptions}
      defaultSort={{ id: "createdAt", dir: "desc" }}
      getSortValue={getSortValue}
      filterRow={filterRow}
      getGroupKey={getGroupKey}
      rowActions={rowActions}
      renderDrawer={(r, onClose) => (
        <CollectorDrawer
          row={r}
          onClose={onClose}
          onApprove={approve}
          onReject={reject}
          isPending={isPending}
        />
      )}
      renderBulkActions={renderBulkActions}
      page={page}
      pageSize={pageSize}
      total={total}
      buildPageHref={(p) => buildPageHref(p, activeView)}
      emptyMessage="No collector piece requests found."
    />
  )
}
