import { describe, it, expect, vi, beforeEach } from "vitest"

// getCachedNewsCategoryCounts wraps an unindexed GROUP BY that used to run on every single
// /api/news request; it must be cache-tagged/lifed, and revalidateNewsCache must use
// revalidateTag (not updateTag, which throws outside Server Actions — see
// products-cache-revalidate.test.ts for the same regression on the products cache).
const { cacheTag, cacheLife, revalidateTag, updateTag } = vi.hoisted(() => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(() => {
    throw new Error("updateTag can only be called from within a Server Action.")
  }),
}))

vi.mock("next/cache", () => ({ cacheTag, cacheLife, revalidateTag, updateTag }))
vi.mock("@/drizzle/db", () => ({ db: {} }))

const { getNewsCategoryCountsFromDb } = vi.hoisted(() => ({
  getNewsCategoryCountsFromDb: vi.fn(),
}))
vi.mock("@/features/news/db/news", () => ({
  getNewsCategoryCountsFromDb,
}))

import { getCachedNewsCategoryCounts, revalidateNewsCache } from "@/features/news/db/cache/news"

describe("getCachedNewsCategoryCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getNewsCategoryCountsFromDb.mockResolvedValue({ all: 9, market: 4 })
  })

  // Validates: tagged so a news create/update/delete can bust it
  it("tags the cache entry with the global news tag", async () => {
    await getCachedNewsCategoryCounts()
    expect(cacheTag).toHaveBeenCalledWith(expect.stringContaining("news"))
  })

  // Validates: short TTL, not the default profile — this is a rarely-changing aggregate
  it("sets a short cache lifetime", async () => {
    await getCachedNewsCategoryCounts()
    expect(cacheLife).toHaveBeenCalledWith(
      expect.objectContaining({ revalidate: 30, expire: 90 })
    )
  })

  // Validates: returns the underlying counts unchanged
  it("returns whatever the db layer resolves", async () => {
    const result = await getCachedNewsCategoryCounts()
    expect(result).toEqual({ all: 9, market: 4 })
  })
})

describe("revalidateNewsCache", () => {
  beforeEach(() => vi.clearAllMocks())

  // Regression guard: must never call updateTag, which throws when invoked from a
  // Route Handler / non-Server-Action context (see createNewsAction/deleteNewsAction).
  it("does not call updateTag", () => {
    expect(() => revalidateNewsCache()).not.toThrow()
    expect(updateTag).not.toHaveBeenCalled()
  })

  // Validates: expires the global news tag immediately via the "max" profile
  it("revalidates the global news tag with the 'max' profile", () => {
    revalidateNewsCache()
    expect(revalidateTag).toHaveBeenCalledWith(expect.stringContaining("news"), "max")
  })
})
