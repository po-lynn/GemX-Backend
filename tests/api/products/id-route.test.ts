import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET, PATCH, DELETE } from "@/app/api/products/[id]/route"
import { getCachedProduct } from "@/features/products/db/cache/products"
import { updateProductInDb, deleteProductInDb } from "@/features/products/db/products"
import { getUserById } from "@/features/users/db/users"
import { auth } from "@/lib/auth"

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

describe("GET /api/products/[id]", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getUserById).mockResolvedValue(null)
  })

  it("returns 200 and product with seller when found", async () => {
    const product = { id: "p1", title: "Ruby", sellerId: "u1" }
    const user = { id: "u1", name: "Seller", phone: null, username: "s", displayUsername: "s" }
    vi.mocked(getCachedProduct).mockResolvedValue(product as never)
    vi.mocked(getUserById).mockResolvedValue(user as never)
    const res = await GET({} as NextRequest, params("p1"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toMatchObject({ id: "p1", title: "Ruby" })
    expect(data).toHaveProperty("seller")
    expect(data.seller).toMatchObject({ id: "u1", name: "Seller" })
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
      expect.objectContaining({ title: "Updated Ruby" })
    )
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
    expect(updateProductInDb).toHaveBeenCalled()
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
