import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { POST } from "@/app/api/cron/renew-premium-dealers/route"
import { processAutoRenewals } from "@/features/points/db/points"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/points/db/points", () => ({
  processAutoRenewals: vi.fn(),
}))

const SECRET = "test-secret-abc"

function req(authHeader?: string) {
  const headers: Record<string, string> = {}
  if (authHeader !== undefined) headers["authorization"] = authHeader
  return new Request("http://localhost/api/cron/renew-premium-dealers", {
    method: "POST",
    headers,
  }) as NextRequest
}

describe("POST /api/cron/renew-premium-dealers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.stubEnv("CRON_SECRET", SECRET)
  })

  it("returns 401 when authorization header is missing", async () => {
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

  it("returns renewal counts on success", async () => {
    vi.mocked(processAutoRenewals).mockResolvedValue({ renewed: 3, expired: 2, failed: 1 })

    const res = await POST(req(`Bearer ${SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ renewed: 3, expired: 2, failed: 1 })
    expect(processAutoRenewals).toHaveBeenCalledOnce()
  })

  it("returns 500 when processAutoRenewals throws", async () => {
    vi.mocked(processAutoRenewals).mockRejectedValue(new Error("db error"))

    const res = await POST(req(`Bearer ${SECRET}`))
    expect(res.status).toBe(500)
  })
})
