import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { POST } from "@/app/api/products/route"
import { createProductInDb } from "@/features/products/db/products"
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
  revalidateProductsCache: vi.fn(),
}))
vi.mock("@/features/products/db/products", () => ({
  createProductInDb: vi.fn(),
  getAdminProductsFromDb: vi.fn(),
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
