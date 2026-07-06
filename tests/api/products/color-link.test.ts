import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { POST } from "@/app/api/products/route"
import { PATCH } from "@/app/api/products/[id]/route"
import { createProductInDb, updateProductInDb } from "@/features/products/db/products"
import { getCachedProduct } from "@/features/products/db/cache/products"
import { deductUserPoints, getUserPointBalance } from "@/features/points/db/points"
import { getColorById } from "@/features/colors/db/color"
import { auth } from "@/lib/auth"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: {
    api: { getSession: vi.fn() },
  },
}))
vi.mock("@/features/products/db/cache/products", () => ({
  getAdminProducts: vi.fn(),
  getCachedProduct: vi.fn(),
  revalidateProductsCache: vi.fn(),
}))
vi.mock("@/features/products/db/products", () => ({
  createProductInDb: vi.fn(),
  getAdminProductsFromDb: vi.fn(),
  updateProductInDb: vi.fn(),
}))
vi.mock("@/features/points/db/points", () => ({
  deductUserPoints: vi.fn(),
  getUserPointBalance: vi.fn(),
}))
vi.mock("@/features/colors/db/color", () => ({
  getColorById: vi.fn(),
}))

const VALID_CATEGORY_ID = "00000000-0000-4000-8000-000000000001"
const COLOR_UUID = "b2c3d4e5-f6a7-4890-b123-456789012345"

/** Minimal valid loose_stone body (mirrors route.test.ts). */
const baseBody = {
  title: "Ruby",
  price: "100",
  productType: "loose_stone" as const,
  categoryId: VALID_CATEGORY_ID,
  weightCarat: "1",
  color: "red",
  origin: "Myanmar",
}

function postReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const PRODUCT_UUID = "a1b2c3d4-e5f6-4789-a012-345678901234"
const params = (id: string) => ({ params: Promise.resolve({ id }) })

function patchReq(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/products/${PRODUCT_UUID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/products with colorId", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", role: "user" },
    } as never)
    vi.mocked(getUserPointBalance).mockResolvedValue({
      available: 10_000,
      reserved: 0,
      lifetime: 10_000,
    })
    vi.mocked(deductUserPoints).mockResolvedValue({
      success: true,
      remainingPoints: 9_500,
    })
  })
  // Validates the resolve-and-denormalize path: a known colorId stores both
  // the id and the colour's name in the text column.
  it("resolves colorId and denormalizes the name into color", async () => {
    vi.mocked(getColorById).mockResolvedValue({
      id: COLOR_UUID, name: "Royal Blue", hexCode: "#002366",
      createdAt: new Date(), updatedAt: new Date(),
    })
    vi.mocked(createProductInDb).mockResolvedValue("p1")
    const res = await POST(postReq({ ...baseBody, colorId: COLOR_UUID }) as NextRequest)
    expect(res.status).toBe(201)
    expect(createProductInDb).toHaveBeenCalledWith(
      expect.objectContaining({ colorId: COLOR_UUID, color: "Royal Blue" })
    )
  })

  // Validates rejection of an unknown id: 400, nothing persisted.
  it("returns 400 for an unknown colorId", async () => {
    vi.mocked(getColorById).mockResolvedValue(null)
    const res = await POST(postReq({ ...baseBody, colorId: COLOR_UUID }) as NextRequest)
    expect(res.status).toBe(400)
    expect(await res.json()).toHaveProperty("error", "Unknown colorId")
    expect(createProductInDb).not.toHaveBeenCalled()
  })

  // Validates format rejection: a non-uuid colorId fails Zod validation with 400.
  it("returns 400 for a malformed colorId", async () => {
    const res = await POST(postReq({ ...baseBody, colorId: "not-a-uuid" }) as NextRequest)
    expect(res.status).toBe(400)
    expect(getColorById).not.toHaveBeenCalled()
  })

  // Validates back-compat: a plain color string with no colorId is stored as-is.
  it("still accepts a plain color string without colorId", async () => {
    vi.mocked(createProductInDb).mockResolvedValue("p1")
    const res = await POST(postReq({ ...baseBody, color: "Ocean Blue" }) as NextRequest)
    expect(res.status).toBe(201)
    expect(createProductInDb).toHaveBeenCalledWith(
      expect.objectContaining({ color: "Ocean Blue" })
    )
    expect(getColorById).not.toHaveBeenCalled()
  })

  // Validates the relaxed loose-stone rule: colorId alone satisfies the
  // "color is required for loose stone" constraint.
  it("accepts a loose stone with colorId and no color string", async () => {
    vi.mocked(getColorById).mockResolvedValue({
      id: COLOR_UUID, name: "Red", hexCode: "#D32F2F",
      createdAt: new Date(), updatedAt: new Date(),
    })
    vi.mocked(createProductInDb).mockResolvedValue("p1")
    const body = { ...baseBody, productType: "loose_stone", colorId: COLOR_UUID }
    delete (body as Record<string, unknown>).color
    const res = await POST(postReq(body) as NextRequest)
    expect(res.status).toBe(201)
    expect(createProductInDb).toHaveBeenCalledWith(
      expect.objectContaining({ color: "Red" })
    )
  })
})

describe("PATCH /api/products/[id] with colorId", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "seller-1", role: "user" },
    } as never)
    vi.mocked(getCachedProduct).mockResolvedValue({
      id: PRODUCT_UUID,
      sellerId: "seller-1",
    } as never)
    vi.mocked(updateProductInDb).mockResolvedValue(undefined)
    vi.mocked(getUserPointBalance).mockResolvedValue({
      available: 10_000,
      reserved: 0,
      lifetime: 10_000,
    })
    vi.mocked(deductUserPoints).mockResolvedValue({
      success: true,
      remainingPoints: 9_500,
    })
  })

  // Validates the resolve-and-denormalize path on PATCH: a known colorId
  // stores both the id and the colour's resolved name in the text column.
  it("resolves colorId and denormalizes the name into color", async () => {
    vi.mocked(getColorById).mockResolvedValue({
      id: COLOR_UUID, name: "Royal Blue", hexCode: "#002366",
      createdAt: new Date(), updatedAt: new Date(),
    })
    const res = await PATCH(patchReq({ colorId: COLOR_UUID }) as NextRequest, params(PRODUCT_UUID))
    expect(res.status).toBe(200)
    expect(updateProductInDb).toHaveBeenCalledWith(
      PRODUCT_UUID,
      expect.objectContaining({ colorId: COLOR_UUID, color: "Royal Blue" }),
      { actorId: "seller-1" }
    )
  })

  // Validates rejection of an unknown id on PATCH: 400, nothing persisted,
  // no points side effects triggered.
  it("returns 400 for an unknown colorId and does not persist or touch points", async () => {
    vi.mocked(getColorById).mockResolvedValue(null)
    const res = await PATCH(patchReq({ colorId: COLOR_UUID }) as NextRequest, params(PRODUCT_UUID))
    expect(res.status).toBe(400)
    expect(await res.json()).toHaveProperty("error", "Unknown colorId")
    expect(updateProductInDb).not.toHaveBeenCalled()
    expect(deductUserPoints).not.toHaveBeenCalled()
  })

  // Regression test for the stale-link bug: sending only a plain color string
  // (no colorId key) must clear any previously-linked colorId to null.
  it("clears a stale colorId link when only a plain color string is sent", async () => {
    const res = await PATCH(patchReq({ color: "Greenish" }) as NextRequest, params(PRODUCT_UUID))
    expect(res.status).toBe(200)
    expect(updateProductInDb).toHaveBeenCalledWith(
      PRODUCT_UUID,
      expect.objectContaining({ color: "Greenish", colorId: null }),
      { actorId: "seller-1" }
    )
    expect(getColorById).not.toHaveBeenCalled()
  })

  // Validates the no-op case: when neither field is supplied, both colour
  // columns are passed through as undefined so updateProductInDb skips them.
  it("leaves both colour fields untouched when neither is supplied", async () => {
    const res = await PATCH(patchReq({ title: "Renamed Ruby" }) as NextRequest, params(PRODUCT_UUID))
    expect(res.status).toBe(200)
    const call = vi.mocked(updateProductInDb).mock.calls[0]
    expect(call[1].colorId).toBeUndefined()
    expect(call[1].color).toBeUndefined()
  })

  // Validates explicit unlink: colorId: null clears the link without
  // resolving a color name (getColorById must not be called for null).
  it("clears colorId when explicitly set to null", async () => {
    const res = await PATCH(patchReq({ colorId: null }) as NextRequest, params(PRODUCT_UUID))
    expect(res.status).toBe(200)
    expect(getColorById).not.toHaveBeenCalled()
    expect(updateProductInDb).toHaveBeenCalledWith(
      PRODUCT_UUID,
      expect.objectContaining({ colorId: null }),
      { actorId: "seller-1" }
    )
  })
})
