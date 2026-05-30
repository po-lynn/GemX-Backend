"use client"

import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Star,
  TrendingUp,
  Gift,
  Settings,
  X,
} from "lucide-react"
import { ListViewCard } from "@/components/admin/list-view"
import { StatusPill } from "@/components/admin/list-view/StatusPill"
import type { ColumnDef, ViewTab, FilterDef } from "@/components/admin/list-view"
import type { PointTransactionRow } from "@/features/points/db/points"

// ─── Helpers ──────────────────────────────────────────────

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

function fmtTime(d: Date): string {
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}

function fmtPts(n: number): string {
  return n.toLocaleString("en-US")
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

// ─── Detail Drawer ─────────────────────────────────────────

function TransactionDrawer({ row, onClose }: { row: PointTransactionRow; onClose: () => void }) {
  const typeLabel = TYPE_LABELS[row.type] ?? row.type
  const isCredit = row.direction === "credit"

  return (
    <>
      <div className="lv-drawer-backdrop" onClick={onClose} />
      <aside className="lv-drawer" role="dialog" aria-label="Transaction detail">
        <header className="lv-drawer-head">
          <div
            className="rt-head-icon"
            data-type={isCredit ? "positive" : "negative"}
          >
            {isCredit
              ? <ArrowDownLeft style={{ width: 22, height: 22 }} />
              : <ArrowUpRight style={{ width: 22, height: 22 }} />
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="lv-drawer-title">
              {isCredit ? "+" : "−"}{fmtPts(row.amount)} pts
            </div>
            <div className="lv-drawer-sub">{typeLabel} · {row.status}</div>
          </div>
          <button className="lv-drawer-close" onClick={onClose} aria-label="Close">
            <X style={{ width: 16, height: 16 }} />
          </button>
        </header>

        <div className="lv-drawer-body">
          <section>
            <h3 className="lv-drawer-section-h">Details</h3>
            <dl className="pt-drawer-kv">
              <dt>Type</dt>
              <dd>
                <span className={`pt-type ${row.type}`}>
                  {TYPE_ICONS[row.type]}
                  {typeLabel}
                </span>
              </dd>

              <dt>Direction</dt>
              <dd style={{ color: isCredit ? "var(--lv-good)" : "var(--lv-danger)", fontWeight: 600 }}>
                {isCredit ? "Credit (received)" : "Debit (spent)"}
              </dd>

              <dt>Amount</dt>
              <dd className={`pt-amount ${row.direction}`}>
                {isCredit ? "+" : "−"}{fmtPts(row.amount)} pts
              </dd>

              {row.description && (
                <>
                  <dt>Description</dt>
                  <dd>{row.description}</dd>
                </>
              )}

              {row.paymentMethod && (
                <>
                  <dt>Payment</dt>
                  <dd>{row.paymentMethod}</dd>
                </>
              )}

              <dt>Date</dt>
              <dd>{fmtDate(row.createdAt)} {fmtTime(row.createdAt)}</dd>

              <dt>Status</dt>
              <dd><StatusPill status={row.status} /></dd>
            </dl>
          </section>

          <section>
            <h3 className="lv-drawer-section-h">Activity</h3>
            <div className="lv-timeline">
              <div className="lv-timeline-item">
                <span
                  className="lv-timeline-dot"
                  style={{ background: row.status === "completed" ? "var(--lv-good)" : row.status === "pending" ? "var(--lv-info)" : "var(--lv-danger)" }}
                />
                <div>
                  <div className="lv-timeline-title">
                    {row.status === "completed" ? "Transaction completed" : row.status === "pending" ? "Awaiting approval" : "Transaction " + row.status}
                  </div>
                  <div className="lv-timeline-when">{fmtDate(row.createdAt)} · {fmtTime(row.createdAt)}</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </>
  )
}

// ─── Main table component ──────────────────────────────────

type Props = {
  rows: PointTransactionRow[]
  views: ViewTab[]
  activeView: string
  page: number
  pageSize: number
  total: number
  basePath?: string
}

const columnDefs: ColumnDef<PointTransactionRow>[] = [
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
    width: 145,
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
]

const filterDefs: FilterDef[] = [
  {
    id: "type",
    label: "Type",
    type: "multi",
    options: [
      { value: "topup",               label: "Top-up" },
      { value: "premium_activation",  label: "Premium" },
      { value: "feature_activation",  label: "Feature" },
      { value: "registration_bonus",  label: "Bonus" },
      { value: "admin_adjustment",    label: "Adjustment" },
    ],
  },
  { id: "createdAt", label: "Date", type: "daterange" },
]

export function UserPointTransactionTable({ rows, views, activeView, page, pageSize, total, basePath = "/account/points" }: Props) {
  const base = basePath

  return (
    <ListViewCard
      rows={rows}
      columnDefs={columnDefs}
      views={views}
      activeView={activeView}
      buildViewHref={(v) => `${base}?filter=${v}`}
      filterDefs={filterDefs}
      defaultSort={{ id: "createdAt", dir: "desc" }}
      getSortValue={(r, colId) => {
        switch (colId) {
          case "createdAt": return new Date(r.createdAt).getTime()
          case "type":      return r.type
          case "amount":    return r.amount
          case "status":    return r.status
          default:          return ""
        }
      }}
      filterRow={(r, filterId, vals) => {
        if (filterId === "type") return vals.includes(r.type)
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
        const d = new Date(r.createdAt)
        if (grp === "createdAt:day")   return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        if (grp === "createdAt:month") return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
        if (grp === "createdAt:year")  return String(d.getFullYear())
        return null
      }}
      groupOptions={[
        { id: "createdAt:day",   label: "Date · Day" },
        { id: "createdAt:month", label: "Date · Month" },
        { id: "createdAt:year",  label: "Date · Year" },
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
