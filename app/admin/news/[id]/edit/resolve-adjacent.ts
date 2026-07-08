import { getAllNewsIdsOrdered } from "@/features/news/db/news"

export type AdjacentResult = {
  prevHref: string | null
  nextHref: string | null
  position: number | null
  total: number | null
}

export async function resolveAdjacentNews(id: string): Promise<AdjacentResult> {
  const rows = await getAllNewsIdsOrdered()
  const idx = rows.findIndex((r) => r.id === id)
  if (idx === -1) return { prevHref: null, nextHref: null, position: null, total: null }

  return {
    prevHref: idx > 0 ? `/admin/news/${rows[idx - 1].id}/edit` : null,
    nextHref: idx < rows.length - 1 ? `/admin/news/${rows[idx + 1].id}/edit` : null,
    position: idx + 1,
    total: rows.length,
  }
}
