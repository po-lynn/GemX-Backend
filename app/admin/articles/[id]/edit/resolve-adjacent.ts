import { getAllArticleIdsOrdered } from "@/features/articles/db/articles"

export type AdjacentResult = {
  prevHref: string | null
  nextHref: string | null
  position: number | null
  total: number | null
}

export async function resolveAdjacentArticles(id: string): Promise<AdjacentResult> {
  const rows = await getAllArticleIdsOrdered()
  const idx = rows.findIndex((r) => r.id === id)
  if (idx === -1) return { prevHref: null, nextHref: null, position: null, total: null }

  return {
    prevHref: idx > 0 ? `/admin/articles/${rows[idx - 1].id}/edit` : null,
    nextHref: idx < rows.length - 1 ? `/admin/articles/${rows[idx + 1].id}/edit` : null,
    position: idx + 1,
    total: rows.length,
  }
}
