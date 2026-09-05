import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET, POST } from "@/app/api/cron/process-surprise-bonus/route"
import { drainSurpriseBonusJobs } from "@/features/points/services/process-surprise-bonus-jobs"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/points/services/process-surprise-bonus-jobs", () => ({
  drainSurpriseBonusJobs: vi.fn(),
}))

const SECRET = "cron-secret-test"

function req(auth?: string) {
  return new Request("http://localhost/api/cron/process-surprise-bonus", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
  }) as NextRequest
}

describe("GET|POST /api/cron/process-surprise-bonus", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.stubEnv("CRON_SECRET", SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // Validates: missing CRON_SECRET fails closed so the drain route cannot run unauthenticated.
  it("returns 500 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "")
    const res = await POST(req(`Bearer ${SECRET}`))
    expect(res.status).toBe(500)
  })

  // Validates: wrong bearer is rejected before any job drain.
  it("returns 401 without a valid bearer token", async () => {
    const res = await POST(req("Bearer wrong"))
    expect(res.status).toBe(401)
    expect(drainSurpriseBonusJobs).not.toHaveBeenCalled()
  })

  // Validates: authorized POST drains pending surprise_bonus_batch jobs.
  it("returns drain result when authorized via POST", async () => {
    vi.mocked(drainSurpriseBonusJobs).mockResolvedValue({
      batches: 2,
      last: {
        claimed: true,
        jobId: "j1",
        campaignId: "c1",
        batchSize: 100,
        successDelta: 100,
        failedDelta: 0,
        hasMore: false,
        campaignStatus: "completed",
      },
    })
    const res = await POST(req(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.batches).toBe(2)
    expect(drainSurpriseBonusJobs).toHaveBeenCalledWith({ maxBatches: 50 })
  })

  // Validates: Vercel Cron uses GET — same auth + drain behaviour as POST.
  it("accepts GET with the same auth as Vercel Cron", async () => {
    vi.mocked(drainSurpriseBonusJobs).mockResolvedValue({ batches: 0 })
    const getReq = new Request("http://localhost/api/cron/process-surprise-bonus", {
      method: "GET",
      headers: { Authorization: `Bearer ${SECRET}` },
    }) as NextRequest
    const res = await GET(getReq)
    expect(res.status).toBe(200)
    expect(drainSurpriseBonusJobs).toHaveBeenCalledOnce()
  })
})
