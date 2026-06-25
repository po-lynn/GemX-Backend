import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/features/products/db/products", () => ({
  verifyProductInDb: vi.fn().mockResolvedValue(undefined),
  unverifyProductInDb: vi.fn().mockResolvedValue(undefined),
}))

const mockWhere = vi.fn().mockResolvedValue([{ moderationStatus: "approved", isVerified: false }])
vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: mockWhere })) })),
  },
}))

vi.mock("@/lib/action-guard", () => ({
  requireActionRole: vi.fn().mockResolvedValue({ user: { id: "admin-1" } }),
}))

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), cacheTag: vi.fn() }))

vi.mock("@/features/products/db/cache/products", () => ({
  revalidateProductsCache: vi.fn(),
}))

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>()
  return { ...actual, eq: vi.fn(() => "eq") }
})

beforeEach(() => {
  vi.clearAllMocks()
  mockWhere.mockResolvedValue([{ moderationStatus: "approved", isVerified: false }])
})

describe("verifyProductAction", () => {
  it("returns Unauthorized when user lacks products.verify permission", async () => {
    // requireActionRole returns null when session is missing or role is wrong
    const { requireActionRole } = await import("@/lib/action-guard")
    vi.mocked(requireActionRole).mockResolvedValueOnce(null)
    const { verifyProductAction } = await import("@/features/products/actions/products")
    const result = await verifyProductAction("prod-1", true)
    expect(result).toEqual({ error: "Unauthorized" })
  })

  it("returns error when verifying a product with moderationStatus pending", async () => {
    // cannot verify a product that is not approved
    mockWhere.mockResolvedValueOnce([{ moderationStatus: "pending", isVerified: false }])
    const { verifyProductAction } = await import("@/features/products/actions/products")
    const result = await verifyProductAction("prod-1", true)
    expect(result).toEqual({ error: "Product must be approved before verifying" })
  })

  it("returns error when product is not found", async () => {
    // empty result set means product does not exist
    mockWhere.mockResolvedValueOnce([])
    const { verifyProductAction } = await import("@/features/products/actions/products")
    const result = await verifyProductAction("prod-1", true)
    expect(result).toEqual({ error: "Product not found" })
  })

  it("calls verifyProductInDb when approved and isVerified=true", async () => {
    // happy path: approved product gets verified
    const { verifyProductInDb } = await import("@/features/products/db/products")
    const { verifyProductAction } = await import("@/features/products/actions/products")
    const result = await verifyProductAction("prod-1", true)
    expect(verifyProductInDb).toHaveBeenCalledWith("prod-1", "admin-1")
    expect(result).toEqual({ success: true })
  })

  it("calls unverifyProductInDb when isVerified=false regardless of moderationStatus", async () => {
    // un-verify works regardless of approval state
    const { unverifyProductInDb } = await import("@/features/products/db/products")
    const { verifyProductAction } = await import("@/features/products/actions/products")
    const result = await verifyProductAction("prod-1", false)
    expect(unverifyProductInDb).toHaveBeenCalledWith("prod-1", "admin-1")
    expect(result).toEqual({ success: true })
  })
})
