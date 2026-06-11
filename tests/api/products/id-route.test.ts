import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET, PATCH, DELETE } from "@/app/api/products/[id]/route"
import { getCachedProduct } from "@/features/products/db/cache/products"
import { updateProductInDb, deleteProductInDb } from "@/features/products/db/products"
import { getUserById } from "@/features/users/db/users"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"
import { deductUserPoints, getUserPointBalance } from "@/features/points/db/points"

const params = (id: string) => ({ params: Promise.resolve({ id }) })

const VALID_UUID = "a1b2c3d4-e5f6-4789-a012-345678901234"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/products/db/cache/products", () => ({
  getCachedProduct: vi.fn(),
  revalidateProductsCache: vi.fn(),
}))
vi.mock("@/features/products/db/products", () => ({
  updateProductInDb: vi.fn(),
  deleteProductInDb: vi.fn(),
}))
vi.mock("@/features/users/db/users", () => ({
  getUserById: vi.fn(),
}))
vi.mock("@/drizzle/db", () => ({
  db: { select: vi.fn() },
}))
vi.mock("@/features/points/db/points", () => ({
  deductUserPoints: vi.fn(),
  getUserPointBalance: vi.fn(),
}))
vi.mock("@/drizzle/schema/seller-rating-schema", () => ({
  sellerRating: { score: "score", sellerUserId: "seller_user_id" },
}))
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    eq: vi.fn((_c, v) => `eq:${String(v)}`),
    sql: vi.fn(),
  }
})

function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  for (const m of ["from", "where"]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject)
  chain.catch = (reject: (e: unknown) => unknown) => Promise.resolve(rows).catch(reject)
  return chain
}

describe("GET /api/products/[id]", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getUserById).mockResolvedValue(null)
    vi.mocked(db.select).mockReturnValue(selectChain([{ averageScore: 0, totalRatings: 0 }]) as never)
  })

  it("returns 200 and product with seller when found", async () => {
    const product = { id: "p1", title: "Ruby", sellerId: "u1" }
    const user = {
      id: "u1",
      name: "Seller",
      image: "https://img.example/seller.jpg",
      phone: null,
      username: "s",
      displayUsername: "s",
    }
    vi.mocked(getCachedProduct).mockResolvedValue(product as never)
    vi.mocked(getUserById).mockResolvedValue(user as never)
    vi.mocked(db.select).mockReturnValue(selectChain([{ averageScore: 4.5, totalRatings: 12 }]) as never)
    const res = await GET({} as NextRequest, params("p1"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toMatchObject({ id: "p1", title: "Ruby" })
    expect(data).toHaveProperty("seller")
    expect(data.seller).toMatchObject({
      id: "u1",
      name: "Seller",
      image: "https://img.example/seller.jpg",
      rating: { averageScore: 4.5, totalRatings: 12 },
    })
    expect(data).not.toHaveProperty("sellerImage")
    expect(data).not.toHaveProperty("sellerRating")
  })

  it("omits admin changeLog from GET JSON (not exposed publicly)", async () => {
    const product = {
      id: "p1",
      title: "Ruby",
      sellerId: "u1",
      changeLog: [
        {
          id: "log-1",
          createdAt: new Date(),
          changeType: "price" as const,
          oldValue: "USD 1.00",
          newValue: "USD 2.00",
        },
      ],
    }
    vi.mocked(getCachedProduct).mockResolvedValue(product as never)
    const res = await GET({} as NextRequest, params("p1"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).not.toHaveProperty("changeLog")
  })

  it("returns 404 when product not found", async () => {
    vi.mocked(getCachedProduct).mockResolvedValue(null)
    const res = await GET({} as NextRequest, params("missing"))
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data).toHaveProperty("error", "Product not found")
  })

  it("returns 500 when getCachedProduct throws", async () => {
    vi.mocked(getCachedProduct).mockRejectedValue(new Error("DB error"))
    const res = await GET({} as NextRequest, params("p1"))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toHaveProperty("error", "Failed to fetch product")
  })
})

describe("PATCH /api/products/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    vi.mocked(getCachedProduct).mockResolvedValue(null)
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

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    vi.mocked(getCachedProduct).mockResolvedValue({ id: "p1", sellerId: "u1" } as never)
    const req = new Request("http://localhost/api/products/p1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated", price: "200" }),
    })
    const res = await PATCH(req as NextRequest, params("p1"))
    expect(res.status).toBe(401)
    expect(updateProductInDb).not.toHaveBeenCalled()
  })

  it("returns 404 when product not found", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never)
    vi.mocked(getCachedProduct).mockResolvedValue(null)
    const req = new Request("http://localhost/api/products/missing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated", price: "200" }),
    })
    const res = await PATCH(req as NextRequest, params("missing"))
    expect(res.status).toBe(404)
    expect(updateProductInDb).not.toHaveBeenCalled()
  })

  it("returns 403 when user is not seller and not admin", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "other-user", role: "user" },
    } as never)
    vi.mocked(getCachedProduct).mockResolvedValue({
      id: "p1",
      sellerId: "seller-1",
    } as never)
    const req = new Request("http://localhost/api/products/p1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated", price: "200" }),
    })
    const res = await PATCH(req as NextRequest, params("p1"))
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data).toHaveProperty("error", "Forbidden")
    expect(updateProductInDb).not.toHaveBeenCalled()
  })

  it("returns 200 when seller updates own product", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "seller-1", role: "user" },
    } as never)
    vi.mocked(getCachedProduct).mockResolvedValue({
      id: VALID_UUID,
      sellerId: "seller-1",
    } as never)
    const req = new Request(`http://localhost/api/products/${VALID_UUID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Ruby", price: "200" }),
    })
    const res = await PATCH(req as NextRequest, params(VALID_UUID))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty("success", true)
    expect(data).toHaveProperty("productId", VALID_UUID)
    expect(updateProductInDb).toHaveBeenCalledWith(
      VALID_UUID,
      expect.objectContaining({ title: "Updated Ruby" }),
      { actorId: "seller-1" }
    )
  })

  it("returns 400 when seller lacks points to increase featured cost", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "seller-1", role: "user" },
    } as never)
    vi.mocked(getCachedProduct).mockResolvedValue({
      id: VALID_UUID,
      sellerId: "seller-1",
      featured: 0,
      isFeatured: false,
    } as never)
    vi.mocked(getUserPointBalance).mockResolvedValue({
      available: 100,
      reserved: 0,
      lifetime: 500,
    })

    const req = new Request(`http://localhost/api/products/${VALID_UUID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFeatured: true, featured: 500 }),
    })
    const res = await PATCH(req as NextRequest, params(VALID_UUID))

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "Insufficient points balance" })
    expect(deductUserPoints).not.toHaveBeenCalled()
    expect(updateProductInDb).not.toHaveBeenCalled()
  })

  it("returns 200 when admin updates any product", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never)
    vi.mocked(getCachedProduct).mockResolvedValue({
      id: VALID_UUID,
      sellerId: "seller-1",
    } as never)
    const req = new Request(`http://localhost/api/products/${VALID_UUID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Admin Edit", price: "99" }),
    })
    const res = await PATCH(req as NextRequest, params(VALID_UUID))
    expect(res.status).toBe(200)
    expect(updateProductInDb).toHaveBeenCalledWith(
      VALID_UUID,
      expect.any(Object),
      { actorId: "admin-1" }
    )
  })
})

describe("DELETE /api/products/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    vi.mocked(getCachedProduct).mockResolvedValue(null)
    vi.mocked(deleteProductInDb).mockResolvedValue(true)
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    vi.mocked(getCachedProduct).mockResolvedValue({ id: "p1", sellerId: "u1" } as never)
    const res = await DELETE({} as NextRequest, params("p1"))
    expect(res.status).toBe(401)
    expect(deleteProductInDb).not.toHaveBeenCalled()
  })

  it("returns 404 when product not found", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never)
    vi.mocked(getCachedProduct).mockResolvedValue(null)
    const res = await DELETE({} as NextRequest, params("missing"))
    expect(res.status).toBe(404)
    expect(deleteProductInDb).not.toHaveBeenCalled()
  })

  it("returns 403 when user is not seller and not admin", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "other", role: "user" },
    } as never)
    vi.mocked(getCachedProduct).mockResolvedValue({
      id: "p1",
      sellerId: "seller-1",
    } as never)
    const res = await DELETE({} as NextRequest, params("p1"))
    expect(res.status).toBe(403)
    expect(deleteProductInDb).not.toHaveBeenCalled()
  })

  it("returns 200 when seller deletes own product", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "seller-1", role: "user" },
    } as never)
    vi.mocked(getCachedProduct).mockResolvedValue({
      id: "p1",
      sellerId: "seller-1",
    } as never)
    const res = await DELETE({} as NextRequest, params("p1"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty("success", true)
    expect(deleteProductInDb).toHaveBeenCalledWith("p1")
  })
})
