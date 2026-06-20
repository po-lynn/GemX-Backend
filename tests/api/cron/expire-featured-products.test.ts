import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { POST } from "@/app/api/cron/expire-featured-products/route"
import { expireFeaturedProducts } from "@/features/products/db/products"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/products/db/products", () => ({
  expireFeaturedProducts: vi.fn(),
}))

const SECRET = "test-secret-abc"

function req(authHeader?: string) {
  const headers: Record<string, string> = {}
  if (authHeader !== undefined) headers["authorization"] = authHeader
  return new Request("http://localhost/api/cron/expire-featured-products", {
    method: "POST",
    headers,
  }) as NextRequest
}

describe("POST /api/cron/expire-featured-products", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.stubEnv("CRON_SECRET", SECRET)
  })

  it("returns 401 when authorization header is missing", async () => {
    // Vercel sends no auth header if the route is hit directly
    const res = await POST(req())
    expect(res.status).toBe(401)
  })

  it("returns 401 when authorization header is wrong", async () => {
    const res = await POST(req("Bearer wrong-secret"))
    expect(res.status).toBe(401)
  })

  it("returns 500 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "")
    const res = await POST(req(`Bearer ${SECRET}`))
    expect(res.status).toBe(500)
  })

  it("returns expired count on success", async () => {
    vi.mocked(expireFeaturedProducts).mockResolvedValue({ expired: 4 })

    const res = await POST(req(`Bearer ${SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ expired: 4 })
    expect(expireFeaturedProducts).toHaveBeenCalledOnce()
  })

  it("returns 500 when expireFeaturedProducts throws", async () => {
    vi.mocked(expireFeaturedProducts).mockRejectedValue(new Error("db error"))

    const res = await POST(req(`Bearer ${SECRET}`))
    expect(res.status).toBe(500)
  })
})
