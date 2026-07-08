import { getAllColors } from "@/features/colors/db/color"

export type AdjacentResult = {
  prevHref: string | null
  nextHref: string | null
  position: number | null
  total: number | null
}

export async function resolveAdjacentColors(id: string): Promise<AdjacentResult> {
  const colors = await getAllColors()
  const idx = colors.findIndex((c) => c.id === id)
  if (idx === -1) return { prevHref: null, nextHref: null, position: null, total: null }

  return {
    prevHref: idx > 0 ? `/admin/colors/${colors[idx - 1].id}/edit` : null,
    nextHref: idx < colors.length - 1 ? `/admin/colors/${colors[idx + 1].id}/edit` : null,
    position: idx + 1,
    total: colors.length,
  }
}
