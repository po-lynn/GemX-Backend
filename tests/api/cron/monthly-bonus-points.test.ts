import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { POST } from "@/app/api/cron/monthly-bonus-points/route"
import { grantDueMonthlyBonusPoints } from "@/features/points/db/monthly-bonus"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/points/db/monthly-bonus", () => ({
  grantDueMonthlyBonusPoints: vi.fn(),
}))

const SECRET = "cron-secret-test"

function req(auth?: string) {
  return new Request("http://localhost/api/cron/monthly-bonus-points", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
  }) as NextRequest
}

describe("POST /api/cron/monthly-bonus-points", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.stubEnv("CRON_SECRET", SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns 500 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "")
    const res = await POST(req(`Bearer ${SECRET}`))
    expect(res.status).toBe(500)
  })

  it("returns 401 without a valid bearer token", async () => {
    const res = await POST(req("Bearer wrong"))
    expect(res.status).toBe(401)
    expect(grantDueMonthlyBonusPoints).not.toHaveBeenCalled()
  })

  it("returns grant result when authorized", async () => {
    vi.mocked(grantDueMonthlyBonusPoints).mockResolvedValue({
      skipped: false,
      enabled: true,
      amount: 100,
      cycles: 6,
      startDate: "2023-10-01",
      today: "2023-10-01",
      cyclesProcessed: [1],
      usersCredited: 10,
      alreadyHadGrant: 0,
      errors: 0,
    })
    const res = await POST(req(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.usersCredited).toBe(10)
    expect(grantDueMonthlyBonusPoints).toHaveBeenCalledOnce()
  })
})
