"use client"

import { useRouter } from "next/navigation"
import { ListViewCard } from "@/components/admin/list-view"
import type { ColumnDef, ViewTab, FilterDef, GroupOption } from "@/components/admin/list-view"
import type { RatingTagRow } from "@/features/rating-tags/db/rating-tags"

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

function TypePill({ type }: { type: "positive" | "neutral" | "negative" }) {
  return (
    <span className="rt-typepill" data-type={type}>
      <span className="rt-typepill-dot" />
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  )
}

function TagCell({ tag }: { tag: RatingTagRow }) {
  return (
    <div className="rt-cell">
      <span className="rt-tag-chip" data-type={tag.type}>
        {tag.type === "positive" && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
            <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
          </svg>
        )}
        {tag.type === "negative" && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
            <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
          </svg>
        )}
        {tag.type === "neutral" && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}
        {tag.name}
      </span>
    </div>
  )
}

type Props = {
  tags: RatingTagRow[]
  allTags: RatingTagRow[]
  views: ViewTab[]
  activeView: string
}

const BASE = "/admin/settings/rating-tags"

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

export function RatingTagsListView({ tags, allTags, views, activeView }: Props) {
  const router = useRouter()

  const columnDefs: ColumnDef<RatingTagRow>[] = [
    {
      id: "name",
      label: "Tag",
      flex: true,
      sortable: true,
      render: (r) => <TagCell tag={r} />,
    },
    {
      id: "type",
      label: "Sentiment",
      width: 140,
      sortable: true,
      render: (r) => <TypePill type={r.type} />,
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
    { id: "type", label: "Sentiment" },
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
        if (grp === "type") return r.type.charAt(0).toUpperCase() + r.type.slice(1)
        return null
      }}
      filterRow={(r, filterId, vals) => {
        if (filterId === "visibility") {
          return vals.some((v) => (v === "active" && r.isActive) || (v === "hidden" && !r.isActive))
        }
        return null
      }}
      defaultSort={{ id: "type", dir: "asc" }}
      getSortValue={(r, colId) => {
        switch (colId) {
          case "name":      return r.name.toLowerCase()
          case "type":      return r.type
          case "isActive":  return r.isActive ? 0 : 1
          case "updatedAt": return r.updatedAt.getTime()
          default:          return ""
        }
      }}
      onRowClick={(r) => router.push(`/admin/settings/rating-tags/${r.id}/edit`)}
      buildPageHref={(pg) => buildPageHref(pg, activeView)}
      emptyMessage="No rating tags found. Try adjusting the filters or create a new tag."
    />
  )
}
