"use client"

import {
  ArrowDownLeft,
  ArrowUpRight,
  Star,
  TrendingUp,
  Gift,
  Settings,
  X,
} from "lucide-react"
import { ListViewCard } from "@/components/admin/list-view"
import { StatusPill } from "@/components/admin/list-view/StatusPill"
import type { ColumnDef, ViewTab, FilterDef } from "@/components/admin/list-view"
import type { PointTransactionAdminRow } from "@/features/points/db/points"

// ─── Helpers ──────────────────────────────────────────────

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}
function fmtTime(d: Date) {
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}
function fmtPts(n: number) { return n.toLocaleString("en-US") }
function getInitials(name: string | null) {
  if (!name) return "?"
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
}
function getHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 6
  return h + 1
}

const TYPE_LABELS: Record<string, string> = {
  topup:               "Top-up",
  premium_activation:  "Premium",
  feature_activation:  "Feature",
  registration_bonus:  "Bonus",
  admin_adjustment:    "Adjustment",
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  topup:               <ArrowDownLeft style={{ width: 11, height: 11 }} />,
  premium_activation:  <Star style={{ width: 11, height: 11 }} />,
  feature_activation:  <TrendingUp style={{ width: 11, height: 11 }} />,
  registration_bonus:  <Gift style={{ width: 11, height: 11 }} />,
  admin_adjustment:    <Settings style={{ width: 11, height: 11 }} />,
}

// ─── Detail drawer ─────────────────────────────────────────

function TransactionDrawer({ row, onClose }: { row: PointTransactionAdminRow; onClose: () => void }) {
  const isCredit = row.direction === "credit"
  return (
    <>
      <div className="lv-drawer-backdrop" onClick={onClose} />
      <aside className="lv-drawer" role="dialog" aria-label="Transaction detail">
        <header className="lv-drawer-head">
          <div className="rt-head-icon" data-type={isCredit ? "positive" : "negative"}>
            {isCredit
              ? <ArrowDownLeft style={{ width: 22, height: 22 }} />
              : <ArrowUpRight style={{ width: 22, height: 22 }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="lv-drawer-title">
              {isCredit ? "+" : "−"}{fmtPts(row.amount)} pts
            </div>
            <div className="lv-drawer-sub">{TYPE_LABELS[row.type] ?? row.type} · {row.status}</div>
          </div>
          <button className="lv-drawer-close" onClick={onClose} aria-label="Close">
            <X style={{ width: 16, height: 16 }} />
          </button>
        </header>

        <div className="lv-drawer-body">
          <section>
            <h3 className="lv-drawer-section-h">User</h3>
            <div className="lv-cell-user">
              <span className="lv-avatar" data-hue={getHue(row.userId)}>
                {getInitials(row.userName)}
              </span>
              <div className="lv-cell-user-meta">
                <span className="lv-cell-name">{row.userName ?? "—"}</span>
                <span className="lv-cell-sub">{row.userEmail ?? row.userId}</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="lv-drawer-section-h">Transaction</h3>
            <dl className="pt-drawer-kv">
              <dt>Type</dt>
              <dd><span className={`pt-type ${row.type}`}>{TYPE_ICONS[row.type]}{TYPE_LABELS[row.type] ?? row.type}</span></dd>
              <dt>Direction</dt>
              <dd style={{ color: isCredit ? "var(--lv-good)" : "var(--lv-danger)", fontWeight: 600 }}>
                {isCredit ? "Credit" : "Debit"}
              </dd>
              <dt>Amount</dt>
              <dd className={`pt-amount ${row.direction}`}>{isCredit ? "+" : "−"}{fmtPts(row.amount)} pts</dd>
              {row.description && <><dt>Description</dt><dd>{row.description}</dd></>}
              {row.paymentMethod && <><dt>Payment</dt><dd>{row.paymentMethod}</dd></>}
              <dt>Date</dt>
              <dd>{fmtDate(row.createdAt)} {fmtTime(row.createdAt)}</dd>
              <dt>Status</dt>
              <dd><StatusPill status={row.status} /></dd>
            </dl>
          </section>
        </div>
      </aside>
    </>
  )
}

// ─── Column definitions ────────────────────────────────────

const columnDefs: ColumnDef<PointTransactionAdminRow>[] = [
  {
    id: "user",
    label: "User",
    width: 200,
    sortable: true,
    render: (r) => (
      <div className="lv-cell-user">
        <span className="lv-avatar" data-hue={getHue(r.userId)} style={{ width: 30, height: 30, fontSize: 11, flexShrink: 0 }}>
          {getInitials(r.userName)}
        </span>
        <div className="lv-cell-user-meta" style={{ minWidth: 0 }}>
          <span className="lv-cell-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.userName ?? "—"}
          </span>
          <span className="lv-cell-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.userEmail ?? r.userId}
          </span>
        </div>
      </div>
    ),
  },
  {
    id: "description",
    label: "Description",
    flex: true,
    sortable: false,
    render: (r) => (
      <div className="pt-desc">
        <span className="pt-desc-main">{r.description ?? TYPE_LABELS[r.type] ?? r.type}</span>
        {r.paymentMethod && <span className="pt-desc-sub">{r.paymentMethod}</span>}
      </div>
    ),
  },
  {
    id: "type",
    label: "Type",
    width: 135,
    sortable: true,
    render: (r) => (
      <span className={`pt-type ${r.type}`}>
        {TYPE_ICONS[r.type]}
        {TYPE_LABELS[r.type] ?? r.type}
      </span>
    ),
  },
  {
    id: "amount",
    label: "Amount",
    width: 120,
    align: "right",
    sortable: true,
    render: (r) => (
      <span className={`pt-amount ${r.direction}`}>
        {r.direction === "credit" ? "+" : "−"}{fmtPts(r.amount)}
      </span>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontSize: 13, color: "var(--lv-text)", fontWeight: 500 }}>{fmtDate(r.createdAt)}</span>
        <span style={{ fontSize: 11.5, color: "var(--lv-text-3)" }}>{fmtTime(r.createdAt)}</span>
      </div>
    ),
  },
]

const filterDefs: FilterDef[] = [
  {
    id: "type",
    label: "Type",
    type: "multi",
    options: [
      { value: "topup",              label: "Top-up" },
      { value: "premium_activation", label: "Premium" },
      { value: "feature_activation", label: "Feature" },
      { value: "registration_bonus", label: "Bonus" },
      { value: "admin_adjustment",   label: "Adjustment" },
    ],
  },
  {
    id: "direction",
    label: "Direction",
    type: "multi",
    options: [
      { value: "credit", label: "Credit (received)" },
      { value: "debit",  label: "Debit (spent)" },
    ],
  },
  { id: "createdAt", label: "Date", type: "daterange" },
]

// ─── Main component ────────────────────────────────────────

type Props = {
  rows: PointTransactionAdminRow[]
  views: ViewTab[]
  activeView: string
  page: number
  pageSize: number
  total: number
}

export function PointTransactionsTable({ rows, views, activeView, page, pageSize, total }: Props) {
  const base = "/admin/credit/transactions"

  return (
    <ListViewCard
      rows={rows}
      columnDefs={columnDefs}
      views={views}
      activeView={activeView}
      buildViewHref={(v) => `${base}?filter=${v}`}
      filterDefs={filterDefs}
      defaultSort={{ id: "createdAt", dir: "desc" }}
      getSortValue={(r, col) => {
        switch (col) {
          case "user":      return r.userName ?? ""
          case "type":      return r.type
          case "amount":    return r.amount
          case "status":    return r.status
          case "createdAt": return new Date(r.createdAt).getTime()
          default:          return ""
        }
      }}
      filterRow={(r, filterId, vals) => {
        if (filterId === "type")      return vals.includes(r.type)
        if (filterId === "direction") return vals.includes(r.direction)
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
      getGroupKey={(r, grp) => {
        if (grp === "user")            return r.userName ?? r.userId
        if (grp === "type")            return TYPE_LABELS[r.type] ?? r.type
        const d = new Date(r.createdAt)
        if (grp === "createdAt:month") return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
        if (grp === "createdAt:day")   return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        return null
      }}
      groupOptions={[
        { id: "user",           label: "User" },
        { id: "type",           label: "Type" },
        { id: "createdAt:month", label: "Date · Month" },
        { id: "createdAt:day",  label: "Date · Day" },
      ]}
      renderDrawer={(r, onClose) => <TransactionDrawer row={r} onClose={onClose} />}
      page={page}
      pageSize={pageSize}
      total={total}
      buildPageHref={(p) => `${base}?filter=${activeView}&page=${p}`}
      emptyMessage="No transactions yet"
    />
  )
}
