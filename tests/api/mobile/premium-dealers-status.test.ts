import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET } from "@/app/api/mobile/premium-dealers/status/route"
import { auth } from "@/lib/auth"
import { getMyPremiumStatus } from "@/features/points/db/points"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/points/db/points", () => ({
  getMyPremiumStatus: vi.fn(),
}))

const SESSION = { user: { id: "user-1" } }

function req() {
  return new Request("http://localhost/api/mobile/premium-dealers/status") as NextRequest
}

describe("GET /api/mobile/premium-dealers/status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it("returns points and active:false when user has no premium", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(getMyPremiumStatus).mockResolvedValue({ points: 350, active: false })

    const res = await GET(req())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ points: 350, active: false })
  })

  it("returns full status when user has an active premium package", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(getMyPremiumStatus).mockResolvedValue({
      points: 900,
      active: true,
      packageName: "Standard Package",
      expiresAt: "2026-08-28T00:00:00.000Z",
      daysRemaining: 42,
      autoRenew: true,
    })

    const res = await GET(req())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      points: 900,
      active: true,
      packageName: "Standard Package",
      expiresAt: "2026-08-28T00:00:00.000Z",
      daysRemaining: 42,
      autoRenew: true,
    })
  })
})
