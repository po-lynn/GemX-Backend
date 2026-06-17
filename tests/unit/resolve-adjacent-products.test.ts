import { describe, it, expect, vi, beforeEach } from "vitest"
import type { AdminProductRow } from "@/features/products/db/products"

vi.mock("@/features/products/db/products", () => ({
  getAdminProductsFromDb: vi.fn(),
}))

import { getAdminProductsFromDb } from "@/features/products/db/products"
import { resolveAdjacentProducts } from "@/app/admin/products/[id]/edit/resolve-adjacent"

function makeProducts(ids: string[]): AdminProductRow[] {
  return ids.map((id) => ({ id, title: `P-${id}`, createdAt: new Date() } as AdminProductRow))
}

function mockPage(ids: string[], total = ids.length) {
  return { products: makeProducts(ids), total }
}

beforeEach(() => vi.clearAllMocks())

describe("resolveAdjacentProducts", () => {
  it("returns all null without making DB calls when no context params present", async () => {
    const result = await resolveAdjacentProducts("abc", {})
    expect(result).toEqual({ prevHref: null, nextHref: null, position: null, total: null })
    expect(getAdminProductsFromDb).not.toHaveBeenCalled()
  })

  it("returns all null when product not found in page results", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a", "b"]))
    const result = await resolveAdjacentProducts("z", { page: "1" })
    expect(result).toEqual({ prevHref: null, nextHref: null, position: null, total: null })
  })

  it("mid-page: resolves prev and next from same page without extra DB calls", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a", "b", "c"], 10))
    const result = await resolveAdjacentProducts("b", { page: "1" })
    expect(result.prevHref).toMatch(/\/a\/edit/)
    expect(result.prevHref).toContain("page=1")
    expect(result.nextHref).toMatch(/\/c\/edit/)
    expect(result.nextHref).toContain("page=1")
    expect(result.position).toBe(2)
    expect(result.total).toBe(10)
    expect(getAdminProductsFromDb).toHaveBeenCalledTimes(1)
  })

  it("first item on page 1: prevHref is null, nextHref points to next item", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a", "b"], 5))
    const result = await resolveAdjacentProducts("a", { page: "1" })
    expect(result.prevHref).toBeNull()
    expect(result.nextHref).toMatch(/\/b\/edit/)
    expect(result.position).toBe(1)
  })

  it("first item on page 2: fetches prev page to get last item as prevHref", async () => {
    vi.mocked(getAdminProductsFromDb)
      .mockResolvedValueOnce(mockPage(["c", "d"], 4)) // page 2 (current)
      .mockResolvedValueOnce(mockPage(["a", "b"], 4)) // page 1 (prev)
    const result = await resolveAdjacentProducts("c", { page: "2" })
    expect(result.prevHref).toMatch(/\/b\/edit/)
    expect(result.prevHref).toContain("page=1")
    expect(result.nextHref).toMatch(/\/d\/edit/)
    expect(result.nextHref).toContain("page=2")
  })

  it("last item on page: fetches next page to get first item as nextHref", async () => {
    vi.mocked(getAdminProductsFromDb)
      .mockResolvedValueOnce(mockPage(["a", "b"], 4)) // page 1 (current)
      .mockResolvedValueOnce(mockPage(["c", "d"], 4)) // page 2 (next)
    const result = await resolveAdjacentProducts("b", { page: "1" })
    expect(result.prevHref).toMatch(/\/a\/edit/)
    expect(result.nextHref).toMatch(/\/c\/edit/)
    expect(result.nextHref).toContain("page=2")
  })

  it("last item overall: nextHref is null when next page returns empty", async () => {
    vi.mocked(getAdminProductsFromDb)
      .mockResolvedValueOnce(mockPage(["a", "b"], 2)) // page 1 (current)
      .mockResolvedValueOnce(mockPage([], 2))          // page 2 (empty)
    const result = await resolveAdjacentProducts("b", { page: "1" })
    expect(result.nextHref).toBeNull()
  })

  it("passes moderationStatus filter for 'pending' view", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a"]))
    await resolveAdjacentProducts("a", { view: "pending", page: "1" })
    expect(getAdminProductsFromDb).toHaveBeenCalledWith(
      expect.objectContaining({ moderationStatus: "pending" })
    )
  })

  it("passes isFeatured filter for 'featured' view", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a"]))
    await resolveAdjacentProducts("a", { view: "featured", page: "1" })
    expect(getAdminProductsFromDb).toHaveBeenCalledWith(
      expect.objectContaining({ isFeatured: true })
    )
  })

  it("passes excludeStatuses filter for 'all' view", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a"]))
    await resolveAdjacentProducts("a", { view: "all", page: "1" })
    expect(getAdminProductsFromDb).toHaveBeenCalledWith(
      expect.objectContaining({ excludeStatuses: ["archive"] })
    )
  })

  it("passes search and priceMinUSD as parsed number", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a"]))
    await resolveAdjacentProducts("a", { page: "1", search: "ruby", priceMinUSD: "500" })
    expect(getAdminProductsFromDb).toHaveBeenCalledWith(
      expect.objectContaining({ search: "ruby", priceMinUSD: 500 })
    )
  })

  it("preserves view param in generated hrefs", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a", "b"]))
    const result = await resolveAdjacentProducts("a", { view: "pending", page: "1" })
    expect(result.nextHref).toContain("view=pending")
  })

  it("treats invalid view as 'all'", async () => {
    vi.mocked(getAdminProductsFromDb).mockResolvedValueOnce(mockPage(["a"]))
    await resolveAdjacentProducts("a", { view: "bogus", page: "1" })
    expect(getAdminProductsFromDb).toHaveBeenCalledWith(
      expect.objectContaining({ excludeStatuses: ["archive"] })
    )
  })
})
