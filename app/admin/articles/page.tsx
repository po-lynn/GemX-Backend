import Link from "next/link"
import { connection } from "next/server"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getArticlesPaginatedFromDb } from "@/features/articles/db/articles"
import { ArticlesTable } from "@/features/articles/components"

const ARTICLES_PAGE_SIZE = 20

type Props = { searchParams: Promise<{ page?: string }> }

export default async function AdminArticlesPage({ searchParams }: Props) {
  await connection()
  const params = await searchParams
  const rawPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const { items: articles, total } = await getArticlesPaginatedFromDb({ page: rawPage, limit: ARTICLES_PAGE_SIZE })
  const totalPages = Math.max(1, Math.ceil(total / ARTICLES_PAGE_SIZE))

  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Articles</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Create and manage editorial articles with title, author, and block content
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0 shadow-sm">
          <Link href="/admin/articles/new">
            <Plus className="mr-1.5 size-4" />
            New Article
          </Link>
        </Button>
      </div>

      <ArticlesTable articles={articles} page={rawPage} totalPages={totalPages} total={total} />
    </div>
  )
}
