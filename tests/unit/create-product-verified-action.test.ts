import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/features/products/db/products", () => ({
  createProductInDb: vi.fn().mockResolvedValue("prod-new-1"),
  updateProductInDb: vi.fn().mockResolvedValue(undefined),
  deleteProductInDb: vi.fn().mockResolvedValue(undefined),
  verifyProductInDb: vi.fn().mockResolvedValue(undefined),
  unverifyProductInDb: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
  },
}))

vi.mock("@/lib/action-guard", () => ({
  requireActionRole: vi.fn().mockResolvedValue({ user: { id: "admin-1", role: "admin" } }),
}))

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), cacheTag: vi.fn() }))

vi.mock("@/features/products/db/cache/products", () => ({
  revalidateProductsCache: vi.fn(),
}))

vi.mock("@/features/points/db/points", () => ({
  deductUserPoints: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock("@/features/company-settings/db/company-settings", () => ({
  getCompanySettings: vi.fn().mockResolvedValue(null),
}))

vi.mock("@/features/users/db/users", () => ({
  searchUsersForPicker: vi.fn().mockResolvedValue([]),
  getRecentUsersForPicker: vi.fn().mockResolvedValue([]),
  getUsersPaginatedFromDb: vi.fn().mockResolvedValue({ users: [], total: 0 }),
}))

const VALID_CATEGORY_ID = "3f2f1a10-1111-4a2b-8c3d-9e8f7a6b5c4d"

function validCreateFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set("title", "Test Ruby")
  fd.set("price", "100")
  fd.set("categoryId", VALID_CATEGORY_ID)
  fd.set("productType", "loose_stone")
  fd.set("weightCarat", "1.5")
  fd.set("color", "Red")
  fd.set("origin", "Myanmar")
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("createProductAction — GemX Verified on create", () => {
  it("persists isVerified with verifiedBy when moderation is approved and isVerified is on", async () => {
    // happy path: admin creates an approved product with the GemX Verified toggle on
    const { createProductInDb } = await import("@/features/products/db/products")
    const { createProductAction } = await import("@/features/products/actions/products")
    const result = await createProductAction(
      validCreateFormData({ moderationStatus: "approved", isVerified: "on" })
    )
    expect(result).toEqual({ success: true, productId: "prod-new-1" })
    expect(createProductInDb).toHaveBeenCalledWith(
      expect.objectContaining({ isVerified: true, verifiedBy: "admin-1" })
    )
  })

  it("ignores isVerified when moderation status is not approved", async () => {
    // a product cannot be born verified unless it is also approved
    const { createProductInDb } = await import("@/features/products/db/products")
    const { createProductAction } = await import("@/features/products/actions/products")
    const result = await createProductAction(
      validCreateFormData({ moderationStatus: "pending", isVerified: "on" })
    )
    expect(result).toEqual({ success: true, productId: "prod-new-1" })
    expect(createProductInDb).toHaveBeenCalledWith(
      expect.objectContaining({ isVerified: false, verifiedBy: null })
    )
  })

  it("defaults to unverified when the checkbox is not submitted", async () => {
    // disabled/unchecked checkbox is absent from FormData → product stays unverified
    const { createProductInDb } = await import("@/features/products/db/products")
    const { createProductAction } = await import("@/features/products/actions/products")
    const result = await createProductAction(validCreateFormData({ moderationStatus: "approved" }))
    expect(result).toEqual({ success: true, productId: "prod-new-1" })
    expect(createProductInDb).toHaveBeenCalledWith(
      expect.objectContaining({ isVerified: false, verifiedBy: null })
    )
  })

  it("returns Unauthorized without creating when the role guard rejects", async () => {
    // requireActionRole returns null when session is missing or role is wrong
    const { requireActionRole } = await import("@/lib/action-guard")
    vi.mocked(requireActionRole).mockResolvedValueOnce(null)
    const { createProductInDb } = await import("@/features/products/db/products")
    const { createProductAction } = await import("@/features/products/actions/products")
    const result = await createProductAction(
      validCreateFormData({ moderationStatus: "approved", isVerified: "on" })
    )
    expect(result).toEqual({ error: "Unauthorized" })
    expect(createProductInDb).not.toHaveBeenCalled()
  })
})

describe("productCreateSchema — isVerified field", () => {
  it("coerces isVerified to boolean and defaults to undefined when absent", async () => {
    // schema accepts the new optional flag without breaking existing payloads
    const { productCreateSchema } = await import("@/features/products/schemas/products")
    const base = {
      title: "Test Ruby",
      price: "100",
      categoryId: VALID_CATEGORY_ID,
      productType: "loose_stone",
      weightCarat: "1.5",
      color: "Red",
      origin: "Myanmar",
    }
    const without = productCreateSchema.safeParse(base)
    expect(without.success).toBe(true)
    if (without.success) expect(without.data.isVerified).toBeUndefined()

    const withFlag = productCreateSchema.safeParse({ ...base, isVerified: true })
    expect(withFlag.success).toBe(true)
    if (withFlag.success) expect(withFlag.data.isVerified).toBe(true)
  })
})
