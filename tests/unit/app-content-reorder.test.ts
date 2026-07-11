import { describe, it, expect } from "vitest"
import { reorderBySortOrder } from "@/features/app-content/lib/reorder"

type Item = { id: string; sortOrder: number }

const ITEMS: Item[] = [
  { id: "a", sortOrder: 0 },
  { id: "b", sortOrder: 1 },
  { id: "c", sortOrder: 2 },
]

describe("reorderBySortOrder", () => {
  it("moves an item from the front to the back and recomputes sortOrder", () => {
    const result = reorderBySortOrder(ITEMS, "a", "c")
    expect(result.map((i) => i.id)).toEqual(["b", "c", "a"])
    expect(result.map((i) => i.sortOrder)).toEqual([0, 1, 2])
  })

  it("moves an item from the back to the front", () => {
    const result = reorderBySortOrder(ITEMS, "c", "a")
    expect(result.map((i) => i.id)).toEqual(["c", "a", "b"])
  })

  it("returns the input unchanged when activeId equals overId", () => {
    const result = reorderBySortOrder(ITEMS, "a", "a")
    expect(result).toEqual(ITEMS)
  })

  it("returns the input unchanged when activeId is not found", () => {
    const result = reorderBySortOrder(ITEMS, "missing", "a")
    expect(result).toEqual(ITEMS)
  })

  it("returns the input unchanged when overId is not found", () => {
    const result = reorderBySortOrder(ITEMS, "a", "missing")
    expect(result).toEqual(ITEMS)
  })

  it("sorts by existing sortOrder before reordering, regardless of input array order", () => {
    const shuffled: Item[] = [
      { id: "c", sortOrder: 2 },
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 1 },
    ]
    const result = reorderBySortOrder(shuffled, "a", "c")
    expect(result.map((i) => i.id)).toEqual(["b", "c", "a"])
  })
})
