/**
 * Recompute sortOrder after dragging `activeId` to where `overId` currently sits.
 * Sorts by existing sortOrder first so callers can pass items in any array order.
 */
export function reorderBySortOrder<T extends { id: string; sortOrder: number }>(
  items: T[],
  activeId: string,
  overId: string
): T[] {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder)
  const oldIndex = sorted.findIndex((i) => i.id === activeId)
  const newIndex = sorted.findIndex((i) => i.id === overId)
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return items

  const moved = [...sorted]
  const [item] = moved.splice(oldIndex, 1)
  moved.splice(newIndex, 0, item)
  return moved.map((it, idx) => ({ ...it, sortOrder: idx }))
}
