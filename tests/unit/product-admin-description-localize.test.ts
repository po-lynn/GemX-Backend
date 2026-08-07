import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/features/products/db/products", () => ({
  createProductInDb: vi.fn().mockResolvedValue("prod-1"),
  updateProductInDb: vi.fn().mockResolvedValue(undefined),
  getProductById: vi.fn(),
  deleteProductInDb: vi.fn(),
  verifyProductInDb: vi.fn(),
  unverifyProductInDb: vi.fn(),
}))

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([
            {
              sellerId: "seller-1",
              isFeatured: false,
              featured: 0,
              featuredDurationDays: 0,
              featuredExpiresAt: null,
            },
          ]),
        })),
      })),
    })),
    transaction: vi.fn(),
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

vi.mock("@/features/products/services/localize-description", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/products/services/localize-description")
  >("@/features/products/services/localize-description")
  return {
    ...actual,
    buildLocalizedProductDescription: vi.fn(),
  }
})

const VALID_CATEGORY_ID = "3f2f1a10-1111-4a2b-8c3d-9e8f7a6b5c4d"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("createProductAction — description localization", () => {
  it("stores all four description locales from Google Translate on create", async () => {
    const { buildLocalizedProductDescription } = await import(
      "@/features/products/services/localize-description"
    )
    vi.mocked(buildLocalizedProductDescription).mockResolvedValue({
      sourceLanguage: "English",
      description: "Natural ruby",
      descriptionEn: "Natural ruby",
      descriptionMy: "ပတ္တမြား",
      descriptionTh: "ทับทิม",
      descriptionKo: "루비",
    })

    const { createProductInDb } = await import("@/features/products/db/products")
    const { createProductAction } = await import("@/features/products/actions/products")

    const fd = new FormData()
    fd.set("title", "Ruby")
    fd.set("price", "100")
    fd.set("categoryId", VALID_CATEGORY_ID)
    fd.set("productType", "loose_stone")
    fd.set("weightCarat", "1")
    fd.set("color", "red")
    fd.set("origin", "Myanmar")
    fd.set("description", "Natural ruby")
    fd.set("isOwnProduct", "true")

    const result = await createProductAction(fd)
    expect(result).toEqual({
      success: true,
      productId: "prod-1",
      language: "English",
    })
    expect(createProductInDb).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Natural ruby",
        language: "English",
        descriptionEn: "Natural ruby",
        descriptionMy: "ပတ္တမြား",
        descriptionTh: "ทับทิม",
        descriptionKo: "루비",
      }),
    )
  })

  it("returns translation error without inserting when Google is not configured", async () => {
    const { buildLocalizedProductDescription } = await import(
      "@/features/products/services/localize-description"
    )
    vi.mocked(buildLocalizedProductDescription).mockRejectedValue(
      new Error("Google Translate is not configured. Set GOOGLE_TRANSLATE_API_KEY"),
    )
    const { createProductInDb } = await import("@/features/products/db/products")
    const { createProductAction } = await import("@/features/products/actions/products")

    const fd = new FormData()
    fd.set("title", "Ruby")
    fd.set("price", "100")
    fd.set("categoryId", VALID_CATEGORY_ID)
    fd.set("productType", "loose_stone")
    fd.set("weightCarat", "1")
    fd.set("color", "red")
    fd.set("origin", "Myanmar")
    fd.set("description", "Natural ruby")
    fd.set("isOwnProduct", "true")

    const result = await createProductAction(fd)
    expect(result).toMatchObject({ error: expect.stringMatching(/GOOGLE_TRANSLATE_API_KEY/) })
    expect(createProductInDb).not.toHaveBeenCalled()
  })
})

describe("updateProductAction — per-language description edit", () => {
  it("updates only the selected locale column when editLanguage is set", async () => {
    // Same behavior as news/articles: no re-translate on edit.
    const { getProductById, updateProductInDb } = await import(
      "@/features/products/db/products"
    )
    vi.mocked(getProductById).mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      language: "English",
      description: "Natural ruby",
      descriptionEn: "Natural ruby",
      descriptionMy: "old-my",
      descriptionTh: "old-th",
      descriptionKo: "old-ko",
    } as never)

    const { updateProductAction } = await import("@/features/products/actions/products")
    const fd = new FormData()
    fd.set("productId", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
    fd.set("editLanguage", "Thai")
    fd.set("description", "ทับทิมธรรมชาติ")
    fd.set("isOwnProduct", "true")

    const result = await updateProductAction(fd)
    expect(result).toEqual({
      success: true,
      productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    })
    expect(updateProductInDb).toHaveBeenCalledWith(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      expect.objectContaining({
        descriptionTh: "ทับทิมธรรมชาติ",
      }),
      expect.anything(),
    )
    const updateArg = vi.mocked(updateProductInDb).mock.calls[0]![1]
    expect(updateArg).not.toHaveProperty("description")
    expect(updateArg).not.toHaveProperty("descriptionEn")
  })
})
