"use client"

import { useRouter } from "next/navigation"
import { ListViewCard } from "@/components/admin/list-view"
import type { ColumnDef, ViewTab, FilterDef, GroupOption } from "@/components/admin/list-view"
import type { OriginOption } from "@/features/origin/db/origin"

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

function oriHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 47 + s.charCodeAt(i)) & 0xffff
  return (h % 200) + 100
}

function OriAvatar({ o }: { o: OriginOption }) {
  const hue = o.country === "Myanmar" ? 38 : oriHue(o.name)
  const initials = o.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "OR"
  return (
    <span className="ori-avatar" style={{ "--hue": hue } as React.CSSProperties}>
      <span className="ori-avatar-glyph">{initials}</span>
    </span>
  )
}

function CountryPill({ country }: { country: string }) {
  return (
    <span className="ori-country-pill" data-myanmar={country === "Myanmar" ? "true" : undefined}>
      <span className="ori-country-dot" />
      {country === "Myanmar" ? "Myanmar" : "Other"}
    </span>
  )
}

type Props = {
  origins: OriginOption[]
  allOrigins: OriginOption[]
  views: ViewTab[]
  activeView: string
}

const BASE = "/admin/origin"

function buildViewHref(view: string): string {
  const p = new URLSearchParams()
  if (view !== "all") p.set("view", view)
  return p.toString() ? `${BASE}?${p}` : BASE
}

function buildPageHref(pg: number, view: string): string {
  const p = new URLSearchParams()
  if (view !== "all") p.set("view", view)
  p.set("page", String(pg))
  return `${BASE}?${p}`
}

export function OriginListView({ origins, allOrigins, views, activeView }: Props) {
  const router = useRouter()

  const columnDefs: ColumnDef<OriginOption>[] = [
    {
      id: "name",
      label: "Origin",
      flex: true,
      sortable: true,
      render: (r) => (
        <div className="ori-cell">
          <OriAvatar o={r} />
          <div className="ori-cell-meta">
            <span className="ori-cell-name">{r.name}</span>
            <span className="ori-cell-country">{r.country === "Myanmar" ? "Myanmar" : r.country}</span>
          </div>
        </div>
      ),
    },
    {
      id: "country",
      label: "Type",
      width: 140,
      sortable: true,
      render: (r) => <CountryPill country={r.country} />,
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

  const filterDefs: FilterDef[] = [
    {
      id: "country",
      label: "Type",
      type: "multi",
      options: [
        { value: "Myanmar", label: "Myanmar", count: allOrigins.filter((o) => o.country === "Myanmar").length },
        { value: "Other",   label: "Other",   count: allOrigins.filter((o) => o.country !== "Myanmar").length },
      ],
    },
  ]

  const groupOptions: GroupOption[] = [
    { id: "country", label: "Type" },
  ]

  return (
    <ListViewCard
      rows={origins}
      columnDefs={columnDefs}
      views={views}
      activeView={activeView}
      buildViewHref={buildViewHref}
      filterDefs={filterDefs}
      groupOptions={groupOptions}
      getGroupKey={(r, grp) => {
        if (grp === "country") return r.country === "Myanmar" ? "Myanmar" : "Other"
        return null
      }}
      filterRow={(r, filterId, vals) => {
        if (filterId === "country") {
          const bucket = r.country === "Myanmar" ? "Myanmar" : "Other"
          return vals.includes(bucket)
        }
        return null
      }}
      defaultSort={{ id: "name", dir: "asc" }}
      getSortValue={(r, colId) => {
        switch (colId) {
          case "name":      return r.name.toLowerCase()
          case "country":   return r.country
          case "updatedAt": return r.updatedAt.getTime()
          default:          return ""
        }
      }}
      onRowClick={(r) => router.push(`/admin/origin/${r.id}/edit`)}
      buildPageHref={(pg) => buildPageHref(pg, activeView)}
      emptyMessage="No origins found. Try adjusting the filters or add a new origin."
    />
  )
}
