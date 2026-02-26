/** Sentinel values for ellipsis in page number lists (used by UI). */
export const ELLIPSIS_PREV = -1
export const ELLIPSIS_NEXT = -2

/**
 * Returns page numbers to display for pagination, including ellipsis when needed.
 * For totalPages <= 7 returns [1..N]. For larger ranges returns [1, ..., window, ..., last].
 */
export function getPageNumbers(page: number, totalPages: number): number[] {
  if (totalPages <= 1) return []
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages: number[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)
  if (start > 2) pages.push(ELLIPSIS_PREV)
  for (let i = start; i <= end; i++) if (!pages.includes(i)) pages.push(i)
  if (end < totalPages - 1) pages.push(ELLIPSIS_NEXT)
  pages.push(totalPages)
  return pages
}
