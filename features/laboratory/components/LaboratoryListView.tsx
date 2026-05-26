"use client"

import { useRouter } from "next/navigation"
import { ListViewCard } from "@/components/admin/list-view"
import type { ColumnDef, ViewTab } from "@/components/admin/list-view"
import type { LaboratoryOption } from "@/features/laboratory/db/laboratory"

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtRelative(d: Date): string {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60)     return "just now"
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return fmtDate(d)
}

function labHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 47 + s.charCodeAt(i)) & 0xffff
  return (h % 260) + 180
}

function LabAvatar({ lab }: { lab: LaboratoryOption }) {
  const hue = labHue(lab.name)
  const initials = lab.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "LB"
  return (
    <span className="lab-avatar" style={{ "--hue": hue } as React.CSSProperties}>
      <span className="lab-avatar-glyph">{initials}</span>
    </span>
  )
}

type Props = {
  laboratories: LaboratoryOption[]
  views: ViewTab[]
  activeView: string
}

const BASE = "/admin/laboratory"

function buildPageHref(pg: number): string {
  const p = new URLSearchParams()
  p.set("page", String(pg))
  return `${BASE}?${p}`
}

export function LaboratoryListView({ laboratories, views, activeView }: Props) {
  const router = useRouter()

  const columnDefs: ColumnDef<LaboratoryOption>[] = [
    {
      id: "name",
      label: "Laboratory",
      flex: true,
      sortable: true,
      render: (r) => (
        <div className="lab-cell">
          <LabAvatar lab={r} />
          <div className="lab-cell-meta">
            <span className="lab-cell-name">{r.name}</span>
            <span className="lab-cell-phone">{r.phone}</span>
          </div>
        </div>
      ),
    },
    {
      id: "address",
      label: "Address",
      flex: true,
      sortable: true,
      render: (r) => (
        <span className="lab-address" title={r.address}>{r.address || "—"}</span>
      ),
    },
    {
      id: "precaution",
      label: "Precaution",
      flex: true,
      sortable: false,
      render: (r) =>
        r.precaution ? (
          <span className="lab-precaution" title={r.precaution}>{r.precaution}</span>
        ) : (
          <span style={{ color: "var(--lv-text-4)", fontSize: 12 }}>—</span>
        ),
    },
    {
      id: "updatedAt",
      label: "Updated",
      width: 150,
      sortable: true,
      render: (r) => (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
          <span style={{ fontSize: 12.5, color: "var(--lv-text)", fontVariantNumeric: "tabular-nums" }}>
            {fmtDate(r.updatedAt)}
          </span>
          <span style={{ fontSize: 10.5, color: "var(--lv-text-3)" }}>
            {fmtRelative(r.updatedAt)}
          </span>
        </div>
      ),
    },
  ]

  return (
    <ListViewCard
      rows={laboratories}
      columnDefs={columnDefs}
      views={views}
      activeView={activeView}
      buildViewHref={() => BASE}
      defaultSort={{ id: "name", dir: "asc" }}
      getSortValue={(r, colId) => {
        switch (colId) {
          case "name":      return r.name.toLowerCase()
          case "address":   return r.address.toLowerCase()
          case "updatedAt": return r.updatedAt.getTime()
          default:          return ""
        }
      }}
      onRowClick={(r) => router.push(`/admin/laboratory/${r.id}/edit`)}
      buildPageHref={buildPageHref}
      emptyMessage="No laboratories yet. Add one to get started."
    />
  )
}
