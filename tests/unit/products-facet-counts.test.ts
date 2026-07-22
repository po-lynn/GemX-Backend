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
  // The consolidated counts query and the category query are both `await`ed directly off
  // the `.innerJoin(...)`/`.where(...)` chain (no `.groupBy()` for the former), so the chain
  // itself must be awaitable.
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
  it("maps the single consolidated counts row and category rows into their per-facet shapes", async () => {
    // Call order matches the Promise.all in getAdminProductFacetCounts: the one consolidated
    // count(*) FILTER (WHERE ...) row first, then the category GROUP BY rows.
    const countsRow = {
      stoneCutFaceted: 3, stoneCutCabochon: 5,
      metalGold: 2, metalSilver: 0, metalOther: 0,
      shapeOval: 1, shapeCushion: 0, shapeRound: 4, shapePear: 0, shapeHeart: 0,
      identificationNatural: 6, identificationHeatTreated: 0, identificationTreatments: 0, identificationOthers: 0,
      productTypeLooseStone: 7, productTypeJewellery: 5,
      moderationPending: 2, moderationApproved: 9, moderationRejected: 0,
      featured: 3, collector: 2, privilege: 1,
    }
    const categoryRows = [
      { id: "cat1", name: "Ruby", count: 4 },
      { id: "cat2", name: "Sapphire", count: 8 },
    ]
    let call = 0
    vi.mocked(db.select).mockImplementation((sel: unknown) => {
      void sel
      call++
      const chain = makeSelectChain(call === 1 ? [countsRow] : categoryRows)
      return chain as ReturnType<typeof db.select>
    })

    const { getAdminProductFacetCounts } = await import("@/features/products/db/products")
    const counts = await getAdminProductFacetCounts({})

    expect(counts.stoneCut).toEqual({ Faceted: 3, Cabochon: 5 })
    expect(counts.metal).toEqual({ Gold: 2, Silver: 0, Other: 0 })
    expect(counts.shape).toEqual({ Oval: 1, Cushion: 0, Round: 4, Pear: 0, Heart: 0 })
    expect(counts.identification).toEqual({ Natural: 6, "Heat Treated": 0, Treatments: 0, Others: 0 })
    expect(counts.productType).toEqual({ loose_stone: 7, jewellery: 5 })
    expect(counts.moderationStatus).toEqual({ pending: 2, approved: 9, rejected: 0 })
    expect(counts.category).toEqual(categoryRows)
    expect(counts.flags).toEqual({ featured: 3, collector: 2, privilege: 1 })

    // Regression guard: this used to be 10 separate round trips (one query per facet/flag).
    // It must stay at 2 (one consolidated FILTER query + one category GROUP BY query) —
    // that fan-out of concurrent queries was what exhausted the connection pool in production.
    expect(db.select).toHaveBeenCalledTimes(2)
  })

  it("excludes a facet's own active filter from its own FILTER(WHERE ...) expression, while every other facet's query still applies it", async () => {
    // Regression test: the admin UI used to compute option counts from the already
    // server-filtered result set, so selecting one option made every sibling option in the
    // SAME filter always show 0, even when matching products existed. Of the facet WHERE
    // clauses built (stoneCut, metal, shape, identification, productType, moderation,
    // featured, collector, privilege, category), only the stoneCut facet's own clause should
    // omit the active stoneCut filter — the other 9 must still apply it. The consolidated
    // query then separately matches each stoneCut option value (Faceted, Cabochon) directly
    // in its own FILTER clause, regardless of the active filter.
    vi.mocked(db.select).mockImplementation(() => makeSelectChain([{}]) as ReturnType<typeof db.select>)

    const { getAdminProductFacetCounts } = await import("@/features/products/db/products")
    await getAdminProductFacetCounts({ stoneCut: "Faceted" })

    const { eq } = await import("drizzle-orm")
    const stoneCutCalls = vi.mocked(eq).mock.calls.filter(([col]) => col === product.stoneCut)
    const facetedCalls = stoneCutCalls.filter(([, val]) => val === "Faceted")
    const cabochonCalls = stoneCutCalls.filter(([, val]) => val === "Cabochon")

    // 9 other WHERE clauses (metal, shape, identification, productType, moderation, featured,
    // collector, privilege, category) apply the active filter, plus the FILTER clause's own
    // direct Faceted-value match = 10. The Cabochon option is matched once, independent of
    // the active filter.
    expect(facetedCalls.length).toBe(10)
    expect(cabochonCalls.length).toBe(1)
    expect(stoneCutCalls.length).toBe(11)
  })
})
