import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/features/products/db/products", () => ({
  createProductInDb: vi.fn().mockResolvedValue("prod-new-1"),
  updateProductInDb: vi.fn().mockResolvedValue(undefined),
  deleteProductInDb: vi.fn().mockResolvedValue(undefined),
  verifyProductInDb: vi.fn().mockResolvedValue(undefined),
  unverifyProductInDb: vi.fn().mockResolvedValue(undefined),
}))

// db.select().from().where().limit(1) must resolve the current product row
// for updateProductAction's featured-points lookup.
const currentRow = {
  sellerId: "seller-1",
  isFeatured: false,
  featured: 0,
  featuredDurationDays: 0,
  featuredExpiresAt: null,
}
vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([currentRow]),
        })),
      })),
    })),
    transaction: vi.fn(),
  },
}))

vi.mock("@/lib/action-guard", () => ({
  requireActionRole: vi.fn().mockResolvedValue({ user: { id: "admin-1", role: "admin" } }),
}))

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), cacheTag: vi.fn(), updateTag: vi.fn() }))

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

vi.mock("@/features/colors/db/color", () => ({
  getColorById: vi.fn(),
}))

import { createProductAction, updateProductAction } from "@/features/products/actions/products"
import { createProductInDb, updateProductInDb } from "@/features/products/db/products"
import { getColorById } from "@/features/colors/db/color"

const VALID_CATEGORY_ID = "3f2f1a10-1111-4a2b-8c3d-9e8f7a6b5c4d"
const COLOR_UUID = "b2c3d4e5-f6a7-4890-b123-456789012345"
const PRODUCT_UUID = "a1b2c3d4-e5f6-4789-a012-345678901234"

const royalBlue = {
  id: COLOR_UUID,
  name: "Royal Blue",
  hexCode: "#002366",
  createdAt: new Date(),
  updatedAt: new Date(),
}

function createFd(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set("title", "Test Sapphire")
  fd.set("price", "100")
  fd.set("categoryId", VALID_CATEGORY_ID)
  fd.set("productType", "loose_stone")
  fd.set("weightCarat", "1.5")
  fd.set("origin", "Myanmar")
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v)
  return fd
}

function updateFd(overrides: Record<string, string> = {}): FormData {
  const fd = createFd(overrides)
  fd.set("productId", PRODUCT_UUID)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("createProductAction with colorId", () => {
  // Validates resolve-and-denormalize: a known colorId stores the id AND
  // writes the colour's name into the color text column.
  it("resolves colorId and denormalizes the name", async () => {
    vi.mocked(getColorById).mockResolvedValue(royalBlue)
    const result = await createProductAction(createFd({ colorId: COLOR_UUID }))
    expect(result).toEqual({ success: true, productId: "prod-new-1" })
    expect(createProductInDb).toHaveBeenCalledWith(
      expect.objectContaining({ colorId: COLOR_UUID, color: "Royal Blue" })
    )
  })

  // Validates the stale-id path: colour deleted between page load and submit
  // → friendly error, nothing persisted.
  it("returns Unknown colorId for a stale id and persists nothing", async () => {
    vi.mocked(getColorById).mockResolvedValue(null)
    const result = await createProductAction(createFd({ colorId: COLOR_UUID }))
    expect(result).toEqual({ error: "Unknown colorId" })
    expect(createProductInDb).not.toHaveBeenCalled()
  })

  // Validates that a loose stone without any colour is rejected by the
  // existing Zod rule (colorId satisfies the requirement; absence fails).
  it("rejects a loose stone with neither colorId nor color", async () => {
    const result = await createProductAction(createFd())
    expect(result).toHaveProperty("error")
    expect(createProductInDb).not.toHaveBeenCalled()
    expect(getColorById).not.toHaveBeenCalled()
  })
})

describe("updateProductAction with colorId", () => {
  // Validates resolve-and-denormalize on update.
  it("resolves colorId and denormalizes the name", async () => {
    vi.mocked(getColorById).mockResolvedValue(royalBlue)
    const result = await updateProductAction(updateFd({ colorId: COLOR_UUID }))
    expect(result).toEqual(expect.objectContaining({ success: true }))
    expect(updateProductInDb).toHaveBeenCalledWith(
      PRODUCT_UUID,
      expect.objectContaining({ colorId: COLOR_UUID, color: "Royal Blue" }),
      expect.anything()
    )
  })

  // Validates that omitting the colour select entirely (jewellery forms never
  // render it) leaves the existing colour columns untouched rather than
  // wiping them — colorId and color must both be undefined, not null.
  it("leaves colour columns untouched when the select is never rendered (jewellery)", async () => {
    const fd = updateFd({ productType: "jewellery" })
    const result = await updateProductAction(fd)
    expect(result).toEqual(expect.objectContaining({ success: true }))
    const payload = vi.mocked(updateProductInDb).mock.calls[0]![1]
    expect(payload.color).toBeUndefined()
    expect(payload.colorId).toBeUndefined()
    expect(getColorById).not.toHaveBeenCalled()
  })

  // Validates the link/text invariant when the select IS rendered but cleared:
  // an explicit empty submission clears both columns together — colorId null
  // AND color null — distinct from the "select absent" case above.
  it("clears both colorId and color when the select is rendered but empty", async () => {
    const fd = updateFd({ colorId: "" })
    const result = await updateProductAction(fd)
    expect(result).toEqual(expect.objectContaining({ success: true }))
    expect(updateProductInDb).toHaveBeenCalledWith(
      PRODUCT_UUID,
      expect.objectContaining({ colorId: null, color: null }),
      expect.anything()
    )
    expect(getColorById).not.toHaveBeenCalled()
  })

  // Validates the stale-id path on update.
  it("returns Unknown colorId on update and persists nothing", async () => {
    vi.mocked(getColorById).mockResolvedValue(null)
    const result = await updateProductAction(updateFd({ colorId: COLOR_UUID }))
    expect(result).toEqual({ error: "Unknown colorId" })
    expect(updateProductInDb).not.toHaveBeenCalled()
  })
})
