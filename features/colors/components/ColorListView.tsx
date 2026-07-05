"use client"

import { useRouter } from "next/navigation"
import { ListViewCard } from "@/components/admin/list-view"
import type { ColumnDef, ViewTab } from "@/components/admin/list-view"
import type { ColorOption } from "@/features/colors/db/color"

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

/** Round swatch dot; dashed outline when the colour has no hex (Multi-color etc.). */
export function ColorSwatch({ hex, size = 18 }: { hex: string; size?: number }) {
  if (!hex) {
    return (
      <span
        title="No swatch"
        style={{
          width: size, height: size, borderRadius: size / 2.6, display: "inline-block",
          flexShrink: 0, border: "1.5px dashed rgba(100,110,130,0.5)",
          background:
            "linear-gradient(135deg, rgba(100,110,130,0.12) 25%, transparent 25%, transparent 50%, rgba(100,110,130,0.12) 50%, rgba(100,110,130,0.12) 75%, transparent 75%)",
          backgroundSize: "6px 6px",
        }}
      />
    )
  }
  return (
    <span
      style={{
        width: size, height: size, borderRadius: size / 2.6, display: "inline-block",
        flexShrink: 0, background: hex, border: "1px solid rgba(15,23,42,0.12)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)",
      }}
    />
  )
}

type Props = {
  colors: ColorOption[]
  views: ViewTab[]
  activeView: string
}

const BASE = "/admin/colors"

export function ColorListView({ colors, views, activeView }: Props) {
  const router = useRouter()

  const columnDefs: ColumnDef<ColorOption>[] = [
    {
      id: "name",
      label: "Color",
      flex: true,
      sortable: true,
      render: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <ColorSwatch hex={r.hexCode} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--lv-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.name}
          </span>
        </div>
      ),
    },
    {
      id: "hexCode",
      label: "Hex",
      width: 120,
      sortable: true,
      render: (r) => (
        <span style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: r.hexCode ? "var(--lv-text-2)" : "var(--lv-text-3)" }}>
          {r.hexCode || "—"}
        </span>
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
      rows={colors}
      columnDefs={columnDefs}
      views={views}
      activeView={activeView}
      buildViewHref={() => BASE}
      filterDefs={[]}
      groupOptions={[]}
      getGroupKey={() => null}
      filterRow={() => null}
      defaultSort={{ id: "name", dir: "asc" }}
      getSortValue={(r, colId) => {
        switch (colId) {
          case "name":      return r.name.toLowerCase()
          case "hexCode":   return r.hexCode
          case "updatedAt": return r.updatedAt.getTime()
          default:          return ""
        }
      }}
      onRowClick={(r) => router.push(`/admin/colors/${r.id}/edit`)}
      buildPageHref={(pg) => `${BASE}?page=${pg}`}
      emptyMessage="No colours found. Add a new colour to get started."
    />
  )
}
