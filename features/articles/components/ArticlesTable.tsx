"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Pencil, Trash2 } from "lucide-react"
import { ListViewCard } from "@/components/admin/list-view"
import type { ColumnDef, ViewTab } from "@/components/admin/list-view"
import type { ArticleRow, ArticleStatusCounts } from "@/features/articles/db/articles"
import { deleteArticleAction } from "@/features/articles/actions/articles"
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
    .join("") || "A"
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

function fmtRelative(d: Date): string {
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  if (s < 2592000) return `${Math.floor(s / 604800)}w ago`
  return fmtDate(d)
}

const STATUS_LABELS: Record<string, string> = {
  published: "Published",
  draft: "Draft",
}

// ─── Types ────────────────────────────────────────────────

type Props = {
  articles: ArticleRow[]
  page: number
  total: number
  pageSize: number
  view: string
  viewCounts: ArticleStatusCounts
}

// ─── Component ────────────────────────────────────────────

export function ArticlesTable({ articles: items, page, total, pageSize, view, viewCounts }: Props) {
  const router = useRouter()
  const base = "/admin/articles"
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
    { id: "drafts",    label: "Drafts",    count: viewCounts.draft },
  ]

  const columnDefs = useMemo((): ColumnDef<ArticleRow>[] => [
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
                {row.author ? (
                  <span style={{ color: "var(--lv-text-3)", fontSize: 11 }}>{row.author}</span>
                ) : null}
              </span>
            </div>
          </div>
        )
      },
    },
    {
      id: "status",
      label: "Status",
      width: 120,
      sortable: false,
      render: (row) => (
        <span className={`lv-status ${row.status}`}>
          {STATUS_LABELS[row.status] ?? row.status}
        </span>
      ),
    },
    {
      id: "publishDate",
      label: "Publish date",
      width: 160,
      sortable: false,
      render: (row) => {
        if (!row.publishDate) return <span style={{ color: "var(--lv-text-3)" }}>—</span>
        return (
          <div className="n-schedcell">
            <span className="n-schedcell-when">{fmtDate(new Date(row.publishDate))}</span>
            <span className="n-schedcell-rel">{fmtRelative(new Date(row.publishDate))}</span>
          </div>
        )
      },
    },
    {
      id: "updatedAt",
      label: "Updated",
      width: 110,
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
        emptyMessage="No articles yet. Create the first one."
        onRefresh={() => router.refresh()}
      />

      <AdminDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete article"
        description={
          <>
            Delete <strong>&ldquo;{deleteTarget?.title}&rdquo;</strong>? This cannot be undone.
          </>
        }
        onDelete={async () => {
          if (!deleteTarget) return
          const form = new FormData()
          form.set("articleId", deleteTarget.id)
          const result = await deleteArticleAction(form)
          if (result?.error) return result.error
          router.refresh()
          setDeleteTarget(null)
        }}
      />
    </>
  )
}
