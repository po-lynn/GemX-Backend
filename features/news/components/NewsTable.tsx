"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Pencil, Trash2 } from "lucide-react"
import { ListViewCard } from "@/components/admin/list-view"
import type { ColumnDef, ViewTab } from "@/components/admin/list-view"
import type { NewsRow, NewsStatusCounts } from "@/features/news/db/news"
import { deleteNewsAction } from "@/features/news/actions/news"
import { AdminDeleteDialog } from "@/components/admin/admin-ui"

// ─── Helpers ──────────────────────────────────────────────

function coverGradient(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return h % 7
}

function coverAbbr(title: string): string {
  return title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "N"
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

function fmtDateTime(d: Date): string {
  const date = new Date(d)
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  return `${fmtDate(date)} · ${h}:${m}`
}

function fmtRelative(d: Date): string {
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 0) {
    const pos = -s
    if (pos < 3600) return `in ${Math.floor(pos / 60)}m`
    if (pos < 86400) return `in ${Math.floor(pos / 3600)}h`
    if (pos < 604800) return `in ${Math.floor(pos / 86400)}d`
    return fmtDate(d)
  }
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  if (s < 2592000) return `${Math.floor(s / 604800)}w ago`
  return fmtDate(d)
}

const STATUS_LABELS: Record<string, string> = {
  published: "Published",
  scheduled: "Scheduled",
  draft: "Draft",
  archived: "Archived",
}

// ─── Types ────────────────────────────────────────────────

type Props = {
  news: NewsRow[]
  page: number
  total: number
  pageSize: number
  view: string
  viewCounts: NewsStatusCounts
}

// ─── Component ────────────────────────────────────────────

export function NewsTable({ news: items, page, total, pageSize, view, viewCounts }: Props) {
  const router = useRouter()
  const base = "/admin/news"
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  function buildViewHref(v: string) {
    return `${base}?view=${v}`
  }

  function buildPageHref(p: number) {
    const sp = new URLSearchParams()
    if (view !== "all") sp.set("view", view)
    sp.set("page", String(p))
    return `${base}?${sp.toString()}`
  }

  const views: ViewTab[] = [
    { id: "all",       label: "All",       count: viewCounts.all },
    { id: "published", label: "Published", count: viewCounts.published },
    { id: "scheduled", label: "Scheduled", count: viewCounts.scheduled },
    { id: "drafts",    label: "Drafts",    count: viewCounts.draft },
    { id: "archived",  label: "Archived",  count: viewCounts.archived },
  ]

  const columnDefs = useMemo((): ColumnDef<NewsRow>[] => [
    {
      id: "title",
      label: "Title",
      flex: true,
      render: (row) => {
        const g = coverGradient(row.id)
        const abbr = coverAbbr(row.title)
        const shortId = row.id.slice(0, 8).toUpperCase()
        return (
          <div className="n-titlecell">
            <div className="n-cover sm" data-g={String(g)}>
              <span className="n-cover-glyph">{abbr}</span>
            </div>
            <div className="n-titlecell-meta">
              <span className="n-titlecell-title">{row.title}</span>
              <span className="n-titlecell-meta-row">
                <span className="n-titlecell-id">{shortId}</span>
              </span>
            </div>
          </div>
        )
      },
    },
    {
      id: "status",
      label: "Status",
      width: 130,
      sortable: false,
      render: (row) => (
        <span className={`lv-status ${row.status}`}>
          {STATUS_LABELS[row.status] ?? row.status}
        </span>
      ),
    },
    {
      id: "publish",
      label: "Publish / Scheduled",
      width: 190,
      sortable: false,
      render: (row) => {
        if (!row.publish) return <span style={{ color: "var(--lv-text-3)" }}>—</span>
        const d = new Date(row.publish)
        const isFuture = d > new Date()
        return (
          <div className="n-schedcell">
            <span className={`n-schedcell-when${isFuture ? " future" : ""}`}>
              {fmtDateTime(d)}
            </span>
            <span className="n-schedcell-rel">{fmtRelative(d)}</span>
          </div>
        )
      },
    },
    {
      id: "updatedAt",
      label: "Updated",
      width: 120,
      sortable: false,
      render: (row) => (
        <span style={{ fontSize: 11.5, color: "var(--lv-text-3)", fontFamily: "var(--font-mono, monospace)" }}>
          {fmtRelative(new Date(row.updatedAt))}
        </span>
      ),
    },
  ], [])

  return (
    <>
      <ListViewCard
        rows={items}
        columnDefs={columnDefs}
        views={views}
        activeView={view}
        buildViewHref={buildViewHref}
        page={page}
        pageSize={pageSize}
        total={total}
        buildPageHref={buildPageHref}
        onRowClick={(row) => router.push(`${base}/${row.id}/edit`)}
        rowActions={(row) => (
          <>
            <Link
              href={`${base}/${row.id}/edit`}
              onClick={(e) => e.stopPropagation()}
              className="lv-rowbtn open"
              aria-label="Edit"
            >
              <Pencil /> Edit
            </Link>
            <button
              type="button"
              className="lv-rowbtn lv-icon lv-danger"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget({ id: row.id, title: row.title })
              }}
              aria-label="Delete"
            >
              <Trash2 />
            </button>
          </>
        )}
        emptyMessage="No news yet. Create the first announcement."
        onRefresh={() => router.refresh()}
      />

      <AdminDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete announcement"
        description={
          <>
            Delete <strong>&ldquo;{deleteTarget?.title}&rdquo;</strong>? This cannot be undone.
          </>
        }
        onDelete={async () => {
          if (!deleteTarget) return
          const form = new FormData()
          form.set("newsId", deleteTarget.id)
          const result = await deleteNewsAction(form)
          if (result?.error) return result.error
          router.refresh()
          setDeleteTarget(null)
        }}
      />
    </>
  )
}
