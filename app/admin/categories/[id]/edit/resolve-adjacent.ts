import { getAllCategories } from "@/features/categories/db/categories"

export type AdjacentResult = {
  prevHref: string | null
  nextHref: string | null
  position: number | null
  total: number | null
}

export async function resolveAdjacentCategories(id: string): Promise<AdjacentResult> {
  const categories = await getAllCategories()
  const idx = categories.findIndex((c) => c.id === id)
  if (idx === -1) return { prevHref: null, nextHref: null, position: null, total: null }

  return {
    prevHref: idx > 0 ? `/admin/categories/${categories[idx - 1].id}/edit` : null,
    nextHref: idx < categories.length - 1 ? `/admin/categories/${categories[idx + 1].id}/edit` : null,
    position: idx + 1,
    total: categories.length,
  }
}
