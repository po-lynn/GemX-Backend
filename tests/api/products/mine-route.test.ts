import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET } from "@/app/api/products/mine/route"
import { getCachedProductsBySellerId } from "@/features/products/db/cache/products"
import { auth } from "@/lib/auth"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/products/db/cache/products", () => ({
  getCachedProductsBySellerId: vi.fn(),
}))

describe("GET /api/products/mine", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getCachedProductsBySellerId).mockResolvedValue({
      products: [],
      total: 0,
    })
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    const req = new Request("http://localhost/api/products/mine")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data).toHaveProperty("error", "Unauthorized")
    expect(getCachedProductsBySellerId).not.toHaveBeenCalled()
  })

  it("returns 200 and products for authenticated seller", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-123", role: "user" },
    } as never)
    const products = [{ id: "p1", title: "My Ruby" }]
    vi.mocked(getCachedProductsBySellerId).mockResolvedValue({
      products: products as never,
      total: 1,
    })
    const req = new Request("http://localhost/api/products/mine")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty("products")
    expect(data).toHaveProperty("total", 1)
    expect(data.products).toHaveLength(1)
    expect(getCachedProductsBySellerId).toHaveBeenCalledWith(
      "user-123",
      expect.any(Object)
    )
  })

  it("returns 500 when getCachedProductsBySellerId throws", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", role: "user" },
    } as never)
    vi.mocked(getCachedProductsBySellerId).mockRejectedValue(new Error("DB error"))
    const req = new Request("http://localhost/api/products/mine")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toHaveProperty("error", "Failed to fetch products")
  })
})
