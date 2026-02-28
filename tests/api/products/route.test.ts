import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET, POST } from "@/app/api/products/route"
import { getAdminProducts } from "@/features/products/db/cache/products"
import { createProductInDb } from "@/features/products/db/products"
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
}))

describe("GET /api/products", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getAdminProducts).mockResolvedValue({ products: [], total: 0 })
  })

  it("returns 200 and list with products and total", async () => {
    const products = [{ id: "p1", title: "Ruby" }]
    vi.mocked(getAdminProducts).mockResolvedValue({
      products: products as never,
      total: 1,
    })
    const req = new Request("http://localhost/api/products")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty("products")
    expect(data).toHaveProperty("total", 1)
    expect(data.products).toHaveLength(1)
    expect(getAdminProducts).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active" })
    )
  })

  it("passes search params to getAdminProducts", async () => {
    const req = new Request(
      "http://localhost/api/products?page=2&search=ruby&productType=loose_stone&status=active"
    )
    await GET(req as NextRequest)
    expect(getAdminProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        search: "ruby",
        productType: "loose_stone",
        status: "active",
      })
    )
  })

  it("returns 500 when getAdminProducts throws", async () => {
    vi.mocked(getAdminProducts).mockRejectedValue(new Error("DB error"))
    const req = new Request("http://localhost/api/products")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toHaveProperty("error", "Failed to fetch products")
  })
})

describe("POST /api/products", () => {
  beforeEach(() => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    vi.mocked(createProductInDb).mockResolvedValue("new-id")
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    const req = new Request("http://localhost/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Ruby", price: "100" }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data).toHaveProperty("error", "Unauthorized")
    expect(createProductInDb).not.toHaveBeenCalled()
  })

  it("returns 400 for invalid body (missing required)", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", role: "user" },
    } as never)
    const req = new Request("http://localhost/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "", price: "100" }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data).toHaveProperty("error")
    expect(createProductInDb).not.toHaveBeenCalled()
  })

  it("returns 201 and productId when valid loose_stone body", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", role: "user" },
    } as never)
    vi.mocked(createProductInDb).mockResolvedValue("prod-123")
    const req = new Request("http://localhost/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Ruby",
        price: "100",
        productType: "loose_stone",
        weightCarat: "1",
        color: "red",
        origin: "Myanmar",
      }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data).toHaveProperty("success", true)
    expect(data).toHaveProperty("productId", "prod-123")
    expect(createProductInDb).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Ruby",
        sellerId: "user-1",
      })
    )
  })

  it("returns 500 when createProductInDb throws", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", role: "user" },
    } as never)
    vi.mocked(createProductInDb).mockRejectedValue(new Error("DB error"))
    const req = new Request("http://localhost/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Ruby",
        price: "100",
        productType: "loose_stone",
        weightCarat: "1",
        color: "red",
        origin: "Myanmar",
      }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toHaveProperty("error", "Failed to create product")
  })
})
