import Link from "next/link"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { Plus, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getArticlesPaginatedFromDb,
  getArticleStatusCountsFromDb,
} from "@/features/articles/db/articles"
import { ArticlesTable } from "@/features/articles/components"
import { FadeUp } from "@/components/admin/motion"
import { withQueryTimeout } from "@/lib/query-timeout"

/** Vercel backstop: if a query hangs past this, the platform kills the render instead of it hanging on the shared connection pool indefinitely. */
export const maxDuration = 10

const ADMIN_ARTICLES_QUERY_TIMEOUT_MS = 6000

const PAGE_SIZE = 20

type Props = {
  searchParams: Promise<{ page?: string; view?: string }>
}

export default async function AdminArticlesPage({ searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.ARTICLES)
  const params = await searchParams
  const rawPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const view = params.view?.trim() ?? "all"

  // Sequential, not Promise.all: two heavy queries fired concurrently on every page load
  // was enough to exceed Supabase's shared pooler connection limit under real traffic —
  // see docs/technical/connection-pool-hardening.md. Each call is timeout-guarded so a
  // stalled query throws (caught by error.tsx) instead of hanging this render indefinitely.
  // Mirrors app/admin/products/page.tsx's established pattern for this list-view shape.
  const counts = await withQueryTimeout(
    getArticleStatusCountsFromDb(),
    ADMIN_ARTICLES_QUERY_TIMEOUT_MS,
    "admin-articles-counts"
  )
  const { items: articles, total } = await withQueryTimeout(
    getArticlesPaginatedFromDb({ page: rawPage, limit: PAGE_SIZE, view }),
    ADMIN_ARTICLES_QUERY_TIMEOUT_MS,
    "admin-articles-list"
  )

  const kpis = [
    {
      label: "All items",
      value: counts.all.toLocaleString(),
      delta: `${counts.published} published · ${counts.draft} drafts`,
      tone: "purple",
    },
    {
      label: "Drafts",
      value: counts.draft.toLocaleString(),
      delta: "Awaiting review",
      tone: "warn",
    },
    {
      label: "Published",
      value: counts.published.toLocaleString(),
      delta: "Visible to all users",
      tone: "emer",
    },
  ]

  return (
    <FadeUp>
    <div className="space-y-5 py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <a href="/admin">Admin</a>
            <ChevronRight className="size-3" />
            <span className="lv-here">News & Articles</span>
          </nav>
          <h1 className="lv-h1">
            News & Articles
            <span className="lv-h1-count">
              {counts.all.toLocaleString()} items
            </span>
          </h1>
          <p className="lv-subhead">
            News and editorial articles with rich block content, author attribution, and publish scheduling.
          </p>
        </div>
        <div className="lv-pagehead-actions">
          <Button asChild size="sm" className="shrink-0 shadow-sm">
            <Link href="/admin/articles/new">
              <Plus className="mr-1.5 size-4" />
              New
            </Link>
          </Button>
        </div>
      </div>

      <div className="lv-kpis">
        {kpis.map((k) => (
          <div key={k.label} className="lv-kpi" data-tone={k.tone}>
            <span className="lv-kpi-label">
              <span className="lv-kpi-dot" />
              {k.label}
            </span>
            <span className="lv-kpi-value">{k.value}</span>
            <span className="lv-kpi-delta">{k.delta}</span>
          </div>
        ))}
      </div>

      <ArticlesTable
        articles={articles}
        page={rawPage}
        total={total}
        pageSize={PAGE_SIZE}
        view={view}
        viewCounts={counts}
      />
    </div>
    </FadeUp>
  )
}
