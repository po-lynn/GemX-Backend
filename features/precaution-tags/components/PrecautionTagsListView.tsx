"use client"

import { useRouter } from "next/navigation"
import { ListViewCard } from "@/components/admin/list-view"
import type { ColumnDef, ViewTab, FilterDef, GroupOption } from "@/components/admin/list-view"
import type { PrecautionTagRow } from "@/features/precaution-tags/db/precaution-tags"

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

const SEV_RANK: Record<string, number> = { critical: 3, warning: 2, info: 1 }

const SEV_LABELS: Record<string, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
}

const APPLIES_LABELS: Record<string, string> = {
  certified: "Certified",
  non_certified: "Non-Certified",
  both: "All products",
}

function SeverityPill({ severity }: { severity: string }) {
  return (
    <span className="pct-sevpill" data-severity={severity}>
      <span className="pct-sevpill-dot" />
      {SEV_LABELS[severity] ?? severity}
    </span>
  )
}

function AppliesToPill({ appliesTo }: { appliesTo: string }) {
  return (
    <span className="pct-applies-pill" data-applies={appliesTo}>
      {APPLIES_LABELS[appliesTo] ?? appliesTo}
    </span>
  )
}

function PrecautionCell({ tag }: { tag: PrecautionTagRow }) {
  return (
    <div className="rt-cell">
      <span className="pct-tag-chip" data-severity={tag.severity}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 4 6v6c0 5 3.4 7.8 8 9 4.6-1.2 8-4 8-9V6z" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        {tag.name}
      </span>
    </div>
  )
}

type Props = {
  tags: PrecautionTagRow[]
  allTags: PrecautionTagRow[]
  views: ViewTab[]
  activeView: string
}

const BASE = "/admin/settings/precaution-tags"

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

export function PrecautionTagsListView({ tags, allTags, views, activeView }: Props) {
  const router = useRouter()

  const columnDefs: ColumnDef<PrecautionTagRow>[] = [
    {
      id: "name",
      label: "Precaution",
      flex: true,
      sortable: true,
      render: (r) => <PrecautionCell tag={r} />,
    },
    {
      id: "appliesTo",
      label: "Applies To",
      width: 160,
      sortable: true,
      render: (r) => <AppliesToPill appliesTo={r.appliesTo} />,
    },
    {
      id: "severity",
      label: "Severity",
      width: 140,
      sortable: true,
      render: (r) => <SeverityPill severity={r.severity} />,
    },
    {
      id: "isActive",
      label: "Visibility",
      width: 120,
      sortable: true,
      render: (r) =>
        r.isActive ? (
          <span className="rt-vis-pill active">Visible</span>
        ) : (
          <span className="rt-vis-pill hidden-tag">Hidden</span>
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

  const filterDefs: FilterDef[] = [
    {
      id: "severity",
      label: "Severity",
      type: "multi",
      options: [
        { value: "critical",  label: "Critical", count: allTags.filter((t) => t.severity === "critical").length },
        { value: "warning",   label: "Warning",  count: allTags.filter((t) => t.severity === "warning").length },
        { value: "info",      label: "Info",     count: allTags.filter((t) => t.severity === "info").length },
      ],
    },
    {
      id: "visibility",
      label: "Visibility",
      type: "multi",
      options: [
        { value: "active", label: "Visible", count: allTags.filter((t) => t.isActive).length },
        { value: "hidden", label: "Hidden",  count: allTags.filter((t) => !t.isActive).length },
      ],
    },
  ]

  const groupOptions: GroupOption[] = [
    { id: "severity",  label: "Severity" },
    { id: "appliesTo", label: "Applies To" },
  ]

  return (
    <ListViewCard
      rows={tags}
      columnDefs={columnDefs}
      views={views}
      activeView={activeView}
      buildViewHref={buildViewHref}
      filterDefs={filterDefs}
      groupOptions={groupOptions}
      getGroupKey={(r, grp) => {
        if (grp === "severity")  return SEV_LABELS[r.severity] ?? r.severity
        if (grp === "appliesTo") return APPLIES_LABELS[r.appliesTo] ?? r.appliesTo
        return null
      }}
      filterRow={(r, filterId, vals) => {
        if (filterId === "severity")   return vals.includes(r.severity)
        if (filterId === "visibility") return vals.some((v) => (v === "active" && r.isActive) || (v === "hidden" && !r.isActive))
        return null
      }}
      defaultSort={{ id: "severity", dir: "desc" }}
      getSortValue={(r, colId) => {
        switch (colId) {
          case "name":      return r.name.toLowerCase()
          case "severity":  return SEV_RANK[r.severity] ?? 0
          case "appliesTo": return r.appliesTo
          case "isActive":  return r.isActive ? 0 : 1
          case "updatedAt": return r.updatedAt.getTime()
          default:          return ""
        }
      }}
      onRowClick={(r) => router.push(`/admin/settings/precaution-tags/${r.id}/edit`)}
      buildPageHref={(pg) => buildPageHref(pg, activeView)}
      emptyMessage="No precaution tags found. Try adjusting the filters or create a new tag."
    />
  )
}
