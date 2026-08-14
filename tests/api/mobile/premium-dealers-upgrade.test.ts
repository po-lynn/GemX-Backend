import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { POST } from "@/app/api/mobile/premium-dealers/upgrade/route"
import { auth } from "@/lib/auth"
import { upgradePremiumDealerPackage } from "@/features/points/db/points"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/points/db/points", () => ({
  upgradePremiumDealerPackage: vi.fn(),
}))

const SESSION = { user: { id: "user-1" } }

describe("POST /api/mobile/premium-dealers/upgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })

  it("returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/api/mobile/premium-dealers/upgrade", {
      method: "POST",
      body: JSON.stringify({ targetPackageName: "Diamond" }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid body", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const req = new Request("http://localhost/api/mobile/premium-dealers/upgrade", {
      method: "POST",
      body: JSON.stringify({}),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "Invalid upgrade request" })
  })

  it("returns 404 when target package is not found", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(upgradePremiumDealerPackage).mockResolvedValue({
      success: false,
      reason: "target_package_not_found",
    })
    const req = new Request("http://localhost/api/mobile/premium-dealers/upgrade", {
      method: "POST",
      body: JSON.stringify({ targetPackageName: "Unknown" }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(404)
  })

  it("returns 409 when user has no active subscription", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(upgradePremiumDealerPackage).mockResolvedValue({
      success: false,
      reason: "no_active_subscription",
    })
    const req = new Request("http://localhost/api/mobile/premium-dealers/upgrade", {
      method: "POST",
      body: JSON.stringify({ targetPackageName: "Diamond" }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(409)
  })

  it("returns 422 when points are insufficient", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(upgradePremiumDealerPackage).mockResolvedValue({
      success: false,
      reason: "insufficient_points",
    })
    const req = new Request("http://localhost/api/mobile/premium-dealers/upgrade", {
      method: "POST",
      body: JSON.stringify({ targetPackageName: "Diamond" }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: "Insufficient points balance" })
  })

  it("returns 200 with upgrade metadata on success", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(upgradePremiumDealerPackage).mockResolvedValue({
      success: true,
      previousPackageName: "Gold",
      packageName: "Diamond",
      pointsUsed: 10_000,
      remainingPoints: 5_000,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2026-02-01T00:00:00.000Z"),
      autoRenew: true,
      status: "active",
    })

    const req = new Request("http://localhost/api/mobile/premium-dealers/upgrade", {
      method: "POST",
      body: JSON.stringify({ targetPackageName: "Diamond" }),
    })
    const res = await POST(req as NextRequest)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(upgradePremiumDealerPackage).toHaveBeenCalledWith("user-1", "Diamond")
    expect(body).toMatchObject({
      success: true,
      previousPackageName: "Gold",
      packageName: "Diamond",
      pointsUsed: 10_000,
      remainingPoints: 5_000,
      autoRenew: true,
      status: "active",
    })
  })
})
