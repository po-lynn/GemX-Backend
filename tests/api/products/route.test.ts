import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET, POST } from "@/app/api/products/route"
import { getPrivilegeAssistBrowse } from "@/features/products/db/cache/products"
import { createProductInDb, getAdminProductsFromDb } from "@/features/products/db/products"
import { deductUserPoints, getUserPointBalance } from "@/features/points/db/points"
import { getApprovedCollectorPieceProductIds } from "@/features/collector-piece-show-requests/db/collector-piece-show-requests"
import { auth } from "@/lib/auth"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: {
    api: { getSession: vi.fn() },
  },
}))
vi.mock("@/features/products/db/cache/products", () => ({
  getPrivilegeAssistBrowse: vi.fn(),
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
vi.mock("@/features/collector-piece-show-requests/db/collector-piece-show-requests", () => ({
  getApprovedCollectorPieceProductIds: vi.fn(),
}))

/** Valid category UUID for product create tests (categoryId is required). */
const VALID_CATEGORY_ID = "00000000-0000-4000-8000-000000000001"

/** Minimal valid loose_stone body for POST /api/products (includes required categoryId, productType, weightCarat, color, origin). */
const validLooseStoneBody = {
  title: "Ruby",
  price: "100",
  productType: "loose_stone" as const,
  categoryId: VALID_CATEGORY_ID,
  weightCarat: "1",
  color: "red",
  origin: "Myanmar",
}

describe("GET /api/products", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getAdminProductsFromDb).mockResolvedValue({ products: [], total: 0 })
    vi.mocked(getPrivilegeAssistBrowse).mockResolvedValue({ products: [], total: 0 } as never)
    vi.mocked(getApprovedCollectorPieceProductIds).mockResolvedValue(new Set())
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })

  it("returns 200 and list with products and total", async () => {
    const products = [{ id: "p1", title: "Ruby" }]
    vi.mocked(getAdminProductsFromDb).mockResolvedValue({
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
    expect(getAdminProductsFromDb).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", sortByPublicPriority: true })
    )
  })

  it("returns featured_expires_at as ISO 8601 on each product", async () => {
    const expires = new Date("2026-06-01T12:00:00.000Z")
    vi.mocked(getAdminProductsFromDb).mockResolvedValue({
      products: [
        {
          id: "p1",
          title: "Featured Ruby",
          isFeatured: true,
          featuredExpiresAt: expires,
        },
      ] as never,
      total: 1,
    })
    const req = new Request("http://localhost/api/products")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      products: Array<{ featured_expires_at: string | null; isFeatured: boolean }>
    }
    expect(data.products[0].featured_expires_at).toBe(expires.toISOString())
    expect(data.products[0].isFeatured).toBe(true)
    expect(data.products[0]).not.toHaveProperty("featuredExpiresAt")
  })

  it("passes search params to getAdminProductsFromDb", async () => {
    const req = new Request(
      "http://localhost/api/products?page=2&search=ruby&productType=loose_stone&status=active"
    )
    await GET(req as NextRequest)
    expect(getAdminProductsFromDb).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        search: "ruby",
        productType: "loose_stone",
        status: "active",
        sortByPublicPriority: true,
      })
    )
  })

  it("uses explicit createdAt sort when sortBy/sortOrder are in the query", async () => {
    const req = new Request(
      "http://localhost/api/products?sortBy=createdAt&sortOrder=desc&limit=6"
    )
    await GET(req as NextRequest)
    expect(getAdminProductsFromDb).toHaveBeenCalledWith(
      expect.objectContaining({
        sortByPublicPriority: false,
        sortBy: "createdAt",
        sortOrder: "desc",
        limit: 6,
      })
    )
  })

  it("uses pure createdAt desc for new-products list when newest=true", async () => {
    const req = new Request("http://localhost/api/products?newest=true&limit=10")
    await GET(req as NextRequest)
    expect(getAdminProductsFromDb).toHaveBeenCalledWith(
      expect.objectContaining({
        sortByPublicPriority: false,
        sortBy: "createdAt",
        sortOrder: "desc",
        limit: 10,
      })
    )
  })

  it("ignores newest=true when search is set (marketplace + relevance ordering)", async () => {
    const req = new Request(
      "http://localhost/api/products?search=ruby&newest=true&limit=10"
    )
    await GET(req as NextRequest)
    expect(getAdminProductsFromDb).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "ruby",
        sortByPublicPriority: true,
        limit: 10,
      })
    )
  })

  it("returns 500 when getAdminProductsFromDb throws", async () => {
    vi.mocked(getAdminProductsFromDb).mockRejectedValue(new Error("DB error"))
    const req = new Request("http://localhost/api/products")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toHaveProperty("error", "Failed to fetch products")
  })

  // Collector-piece browse is intentionally public: no session required. Anonymous
  // requests get every collector piece masked rather than a 401.
  it("returns 200 with masked products when isCollectorPiece=true and no session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    vi.mocked(getAdminProductsFromDb).mockResolvedValue({
      products: [{ id: "p1", price: "500", currency: "USD", status: "active", imageUrl: null }] as never,
      total: 1,
    })
    const req = new Request("http://localhost/api/products?isCollectorPiece=true")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.products[0]).toMatchObject({ title: null, isCollectorPiece: true })
    expect(getApprovedCollectorPieceProductIds).not.toHaveBeenCalled()
  })

  it("uses getAdminProductsFromDb with approved-request filter when isCollectorPiece=true and session present", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", role: "mobile" },
    } as never)
    vi.mocked(getApprovedCollectorPieceProductIds).mockResolvedValue(new Set(["p1"]))
    vi.mocked(getAdminProductsFromDb).mockResolvedValue({
      products: [{ id: "p1", title: "Ruby", price: "500", currency: "USD", status: "active", imageUrl: null }] as never,
      total: 1,
    })
    const req = new Request("http://localhost/api/products?isCollectorPiece=true", {
      headers: { Authorization: "Bearer token" },
    })
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    expect(getAdminProductsFromDb).toHaveBeenCalledWith(
      expect.objectContaining({
        isCollectorPiece: true,
        status: "active",
        sortByPublicPriority: true,
      })
    )
    expect(getApprovedCollectorPieceProductIds).toHaveBeenCalledWith("user-1")
    const cc = res.headers.get("Cache-Control")
    expect(cc).toContain("no-store")
  })

  // Privilege Assist browse with no search/sort/newest override reshuffles — goes through
  // the short-TTL cached wrapper instead of hitting the DB directly on every request.
  it("uses getPrivilegeAssistBrowse for a plain isPrivilegeAssist browse", async () => {
    const req = new Request("http://localhost/api/products?isPrivilegeAssist=true")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    expect(getPrivilegeAssistBrowse).toHaveBeenCalledWith(
      expect.objectContaining({ isPrivilegeAssist: true })
    )
    expect(getAdminProductsFromDb).not.toHaveBeenCalled()
    // Now safe to cache: the wrapper itself refreshes on a short TTL.
    expect(res.headers.get("Cache-Control")).toContain("public")
  })

  // An explicit sort/search/newest override means the caller wants a specific order, not a
  // shuffle — falls back to the uncached direct query even with isPrivilegeAssist=true.
  it("does not use getPrivilegeAssistBrowse when isPrivilegeAssist is combined with an explicit sort", async () => {
    const req = new Request(
      "http://localhost/api/products?isPrivilegeAssist=true&sortBy=createdAt&sortOrder=desc"
    )
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    expect(getPrivilegeAssistBrowse).not.toHaveBeenCalled()
    expect(getAdminProductsFromDb).toHaveBeenCalled()
  })

  // Validates the timeout guard: a hung DB call fails fast with a retryable error instead
  // of hanging until the platform kills the invocation.
  it("returns 503 with Retry-After when the query hangs past the timeout", async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(getAdminProductsFromDb).mockReturnValue(new Promise(() => {}))
      const req = new Request("http://localhost/api/products")
      const resPromise = GET(req as NextRequest)
      await vi.advanceTimersByTimeAsync(6000)
      const res = await resPromise
      expect(res.status).toBe(503)
      expect(res.headers.get("Retry-After")).toBe("3")
      const data = await res.json()
      expect(data.error).toMatch(/retry/i)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("POST /api/products", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    vi.mocked(createProductInDb).mockResolvedValue("new-id")
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

  afterEach(() => {
    vi.useRealTimers()
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

  it("returns 400 when categoryId is missing", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", role: "user" },
    } as never)
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
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data).toHaveProperty("error")
    expect(createProductInDb).not.toHaveBeenCalled()
  })

  it("returns 400 when seller lacks points to create as featured", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", role: "user" },
    } as never)
    vi.mocked(getUserPointBalance).mockResolvedValue({
      available: 100,
      reserved: 0,
      lifetime: 500,
    })

    const req = new Request("http://localhost/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validLooseStoneBody,
        isFeatured: true,
        featured: 500,
      }),
    })
    const res = await POST(req as NextRequest)

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "Insufficient points balance" })
    expect(deductUserPoints).not.toHaveBeenCalled()
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
      body: JSON.stringify(validLooseStoneBody),
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
        categoryId: VALID_CATEGORY_ID,
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
      body: JSON.stringify(validLooseStoneBody),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toHaveProperty("error", "Failed to create product")
  })
})
