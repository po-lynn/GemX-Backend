import { describe, it, expect, vi, beforeEach } from "vitest"

// updateTag throws in Route Handlers (Next 16: "updateTag can only be called
// from within a Server Action"). revalidateProductsCache is shared by server
// actions AND route handlers (POST /api/products, PATCH/DELETE /api/products/[id],
// POST /api/mobile/products/[id]/feature), so it must use the context-safe
// revalidateTag(tag, "max") — never updateTag. Regression test for the mobile
// "Failed to create product" bug where the product was inserted but the
// response still 500'd.
const { revalidateTag, updateTag } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  updateTag: vi.fn(() => {
    // Mirror Next 16 runtime behavior in route handlers so any updateTag usage
    // fails this test the same way it fails in production.
    throw new Error("updateTag can only be called from within a Server Action.")
  }),
}))

vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  revalidateTag,
  updateTag,
}))

// The cache module imports query helpers from ../products which pulls in the
// DB client; stub the whole module chain it needs.
vi.mock("@/drizzle/db", () => ({ db: {} }))

import { revalidateProductsCache } from "@/features/products/db/cache/products"

describe("revalidateProductsCache", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Validates: helper never calls updateTag (which throws in route handlers)
  it("does not call updateTag", () => {
    expect(() => revalidateProductsCache("some-id")).not.toThrow()
    expect(updateTag).not.toHaveBeenCalled()
  })

  // Validates: global products tag is expired immediately via revalidateTag
  it("revalidates the global products tag with the 'max' profile", () => {
    revalidateProductsCache()
    expect(revalidateTag).toHaveBeenCalledWith(expect.stringContaining("products"), "max")
  })

  // Validates: per-product tag is also expired when an id is passed
  it("revalidates the per-product tag when an id is given", () => {
    revalidateProductsCache("abc-123")
    const tags = revalidateTag.mock.calls.map((c) => c[0] as string)
    expect(tags.some((t) => t.includes("abc-123"))).toBe(true)
    expect(revalidateTag.mock.calls.every((c) => c[1] === "max")).toBe(true)
  })
})
