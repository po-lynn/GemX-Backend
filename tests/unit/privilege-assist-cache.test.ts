import { describe, it, expect, vi, beforeEach } from "vitest"

// getPrivilegeAssistBrowse must call the underlying db function with random:true and
// isPrivilegeAssist:true regardless of what the caller passes, and must be tagged/lifed
// for the Next.js data cache so repeat requests within the TTL skip the DB entirely.
const { cacheTag, cacheLife, revalidateTag } = vi.hoisted(() => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock("next/cache", () => ({
  cacheTag,
  cacheLife,
  revalidateTag,
  updateTag: vi.fn(),
}))
vi.mock("@/drizzle/db", () => ({ db: {} }))

const { getAdminProductsFromDb } = vi.hoisted(() => ({
  getAdminProductsFromDb: vi.fn(),
}))
vi.mock("@/features/products/db/products", () => ({
  getAdminProductsFromDb,
  getAdminProductCountsFromDb: vi.fn(),
  getPortalProductCountsFromDb: vi.fn(),
  getProductById: vi.fn(),
  getProductsBySellerId: vi.fn(),
}))

import { getPrivilegeAssistBrowse } from "@/features/products/db/cache/products"

describe("getPrivilegeAssistBrowse", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAdminProductsFromDb.mockResolvedValue({ products: [], total: 0 })
  })

  // Validates: the randomized/flagged shape is forced regardless of caller input
  it("always queries with isPrivilegeAssist:true and random:true", async () => {
    await getPrivilegeAssistBrowse({ page: 1, limit: 10, categoryId: "cat-1" })
    expect(getAdminProductsFromDb).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 10,
        categoryId: "cat-1",
        isPrivilegeAssist: true,
        random: true,
      })
    )
  })

  // Validates: tagged with the shared products cache tag so any product mutation busts it
  it("tags the cache entry with the global products tag", async () => {
    await getPrivilegeAssistBrowse({})
    expect(cacheTag).toHaveBeenCalledWith(expect.stringContaining("products"))
  })

  // Validates: a short revalidate/expire window is set (reshuffle every ~30s, not every request)
  it("sets a short cache lifetime instead of the default profile", async () => {
    await getPrivilegeAssistBrowse({})
    expect(cacheLife).toHaveBeenCalledWith(
      expect.objectContaining({ revalidate: 30, expire: 90 })
    )
  })

  // Validates: the shuffled result itself passes through unchanged
  it("returns whatever the db layer resolves", async () => {
    const products = [{ id: "p1" }] as never
    getAdminProductsFromDb.mockResolvedValue({ products, total: 1 })
    const result = await getPrivilegeAssistBrowse({})
    expect(result).toEqual({ products, total: 1 })
  })
})
