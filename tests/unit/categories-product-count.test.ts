import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(),
  },
}))

import { db } from "@/drizzle/db"
import { getAllCategories, getCategoriesByType } from "@/features/categories/db/categories"

function mockCategoryQuery(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  chain.from = vi.fn().mockReturnValue(chain)
  chain.leftJoin = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.groupBy = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockResolvedValue(rows)
  return chain
}

describe("categories productCount query", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Validates: list queries left-join products and expose productCount on each row.
  it("getAllCategories returns productCount from the aggregated select", async () => {
    const rows = [
      {
        id: "c1",
        type: "loose_stone",
        name: "Ruby",
        shortCode: "RB",
        image: null,
        slug: "ruby",
        sortOrder: 0,
        productCount: 7,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]
    vi.mocked(db.select).mockReturnValue(mockCategoryQuery(rows) as never)

    const result = await getAllCategories()
    expect(result).toEqual(rows)
    expect(result[0]!.productCount).toBe(7)
    expect(db.select).toHaveBeenCalled()
  })

  // Validates: type-filtered list also includes productCount.
  it("getCategoriesByType returns productCount", async () => {
    const rows = [
      {
        id: "c2",
        type: "jewellery",
        name: "Ring",
        shortCode: "RG",
        image: null,
        slug: "ring",
        sortOrder: 1,
        productCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]
    const chain = mockCategoryQuery(rows)
    vi.mocked(db.select).mockReturnValue(chain as never)

    const result = await getCategoriesByType("jewellery")
    expect(result[0]!.productCount).toBe(0)
    expect(chain.where).toHaveBeenCalled()
  })
})
