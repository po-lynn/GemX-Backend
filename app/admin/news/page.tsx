import Link from "next/link"
import { connection } from "next/server"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getNewsPaginatedFromDb } from "@/features/news/db/news"
import { NewsTable } from "@/features/news/components"

const NEWS_PAGE_SIZE = 20

type Props = { searchParams: Promise<{ page?: string }> }

export default async function AdminNewsPage({ searchParams }: Props) {
  await connection()
  const params = await searchParams
  const rawPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const { items: news, total } = await getNewsPaginatedFromDb({ page: rawPage, limit: NEWS_PAGE_SIZE })
  const totalPages = Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE))

  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">News</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Publish and manage news articles with the block editor
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0 shadow-sm">
          <Link href="/admin/news/new">
            <Plus className="mr-1.5 size-4" />
            New News
          </Link>
        </Button>
      </div>

      <NewsTable news={news} page={rawPage} totalPages={totalPages} total={total} />
    </div>
  )
}
