import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/drizzle/db"
import { product } from "@/drizzle/schema/product-schema"

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>()
  return {
    ...actual,
    eq: vi.fn((col: unknown, val: unknown) => ({ __tag: "eq", col, val })),
    and: vi.fn((...args: unknown[]) => ({ __tag: "and", args })),
  }
})

function makeSelectChain(result: unknown[]) {
  const chain: Record<string, unknown> = {}
  chain.from = vi.fn(() => chain)
  chain.innerJoin = vi.fn(() => chain)
  chain.leftJoin = vi.fn(() => chain)
  chain.where = vi.fn(() => chain)
  chain.groupBy = vi.fn().mockResolvedValue(result)
  // Boolean-flag queries `await` the `.where(...)` chain directly (no `.groupBy()` call), so the
  // chain itself must be awaitable.
  chain.then = (resolve: (v: unknown) => void) => resolve(result)
  return chain
}

vi.mock("@/drizzle/db", () => ({
  db: { select: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getAdminProductFacetCounts", () => {
  it("maps grouped rows into per-facet value->count records, and category/flags into their own shapes", async () => {
    // Call order matches the Promise.all in getAdminProductFacetCounts: stoneCut, metal, shape,
    // identification, productType, moderationStatus, category, featured, collector, privilege
    const rowsByCall = [
      [{ value: "Faceted", count: 3 }, { value: "Cabochon", count: 5 }],
      [{ value: "Gold", count: 2 }],
      [{ value: "Oval", count: 1 }, { value: "Round", count: 4 }],
      [{ value: "Natural", count: 6 }],
      [{ value: "loose_stone", count: 7 }, { value: "jewellery", count: 5 }],
      [{ value: "pending", count: 2 }, { value: "approved", count: 9 }],
      [{ id: "cat1", name: "Ruby", count: 4 }, { id: "cat2", name: "Sapphire", count: 8 }],
      [{ count: 3 }],
      [{ count: 2 }],
      [{ count: 1 }],
    ]
    let call = 0
    vi.mocked(db.select).mockImplementation((sel: unknown) => {
      void sel
      const chain = makeSelectChain(rowsByCall[call])
      call++
      return chain as ReturnType<typeof db.select>
    })

    const { getAdminProductFacetCounts } = await import("@/features/products/db/products")
    const counts = await getAdminProductFacetCounts({})

    expect(counts.stoneCut).toEqual({ Faceted: 3, Cabochon: 5 })
    expect(counts.metal).toEqual({ Gold: 2 })
    expect(counts.shape).toEqual({ Oval: 1, Round: 4 })
    expect(counts.identification).toEqual({ Natural: 6 })
    expect(counts.productType).toEqual({ loose_stone: 7, jewellery: 5 })
    expect(counts.moderationStatus).toEqual({ pending: 2, approved: 9 })
    expect(counts.category).toEqual([
      { id: "cat1", name: "Ruby", count: 4 },
      { id: "cat2", name: "Sapphire", count: 8 },
    ])
    expect(counts.flags).toEqual({ featured: 3, collector: 2, privilege: 1 })

    expect(db.select).toHaveBeenNthCalledWith(1, expect.objectContaining({ value: product.stoneCut }))
    expect(db.select).toHaveBeenNthCalledWith(2, expect.objectContaining({ value: product.metal }))
    expect(db.select).toHaveBeenNthCalledWith(3, expect.objectContaining({ value: product.shape }))
    expect(db.select).toHaveBeenNthCalledWith(4, expect.objectContaining({ value: product.identification }))
    expect(db.select).toHaveBeenNthCalledWith(5, expect.objectContaining({ value: product.productType }))
    expect(db.select).toHaveBeenNthCalledWith(6, expect.objectContaining({ value: product.moderationStatus }))
  })

  it("excludes a facet's own active filter from its own count query, while every OTHER facet's query still applies it", async () => {
    // Regression test: the admin UI used to compute option counts from the already
    // server-filtered page of rows, so selecting one option made every sibling option in the
    // SAME filter always show 0, even when matching products existed. Of the 10 facet queries
    // computed (stoneCut, metal, shape, identification, productType, moderation, category,
    // featured, collector, privilege), only the stoneCut facet's own query should omit the
    // active stoneCut filter — the other 9 must still apply it.
    vi.mocked(db.select).mockImplementation(() => makeSelectChain([]) as ReturnType<typeof db.select>)

    const { getAdminProductFacetCounts } = await import("@/features/products/db/products")
    await getAdminProductFacetCounts({ stoneCut: "Faceted" })

    const { eq } = await import("drizzle-orm")
    const stoneCutFilterCalls = vi.mocked(eq).mock.calls.filter(([col]) => col === product.stoneCut)
    expect(stoneCutFilterCalls.length).toBe(9)
    expect(stoneCutFilterCalls.every(([, val]) => val === "Faceted")).toBe(true)
  })
})
