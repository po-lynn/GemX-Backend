import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { POST } from "@/app/api/mobile/premium-dealers/activate/route"
import { auth } from "@/lib/auth"
import {
  activatePremiumDealer,
  getPremiumDealersSettings,
} from "@/features/points/db/points"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/points/db/points", () => ({
  activatePremiumDealer: vi.fn(),
  getPremiumDealersSettings: vi.fn(),
}))

const SESSION = { user: { id: "user-1" } }
const PACKAGE = { name: "Basic Package", pointsRequired: 100, durationDays: 30 }

describe("POST /api/mobile/premium-dealers/activate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    vi.mocked(getPremiumDealersSettings).mockResolvedValue({
      packages: [PACKAGE],
    })
  })

  it("returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/api/mobile/premium-dealers/activate", {
      method: "POST",
      body: JSON.stringify({ packageName: PACKAGE.name, autoRenew: false }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid input when autoRenew is missing", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const req = new Request("http://localhost/api/mobile/premium-dealers/activate", {
      method: "POST",
      body: JSON.stringify({ packageName: PACKAGE.name }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "Invalid input" })
  })

  it("returns 400 when package is not found", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const req = new Request("http://localhost/api/mobile/premium-dealers/activate", {
      method: "POST",
      body: JSON.stringify({ packageName: "Unknown", autoRenew: true }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "Package not found" })
  })

  it("returns 400 when user has insufficient points", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(activatePremiumDealer).mockResolvedValue(null)
    const req = new Request("http://localhost/api/mobile/premium-dealers/activate", {
      method: "POST",
      body: JSON.stringify({ packageName: PACKAGE.name, autoRenew: true }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "Insufficient points balance" })
  })

  it("returns 200 and passes autoRenew into activation flow", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const startDate = new Date("2026-05-08T00:00:00.000Z")
    const expiresAt = new Date("2026-06-07T00:00:00.000Z")
    vi.mocked(activatePremiumDealer).mockResolvedValue({
      remainingPoints: 900,
      startDate,
      expiresAt,
      autoRenew: true,
      status: "active",
    })

    const req = new Request("http://localhost/api/mobile/premium-dealers/activate", {
      method: "POST",
      body: JSON.stringify({ packageName: PACKAGE.name, autoRenew: true }),
    })
    const res = await POST(req as NextRequest)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(activatePremiumDealer).toHaveBeenCalledWith(SESSION.user.id, PACKAGE, true)
    expect(body).toMatchObject({
      success: true,
      packageName: PACKAGE.name,
      pointsUsed: PACKAGE.pointsRequired,
      remainingPoints: 900,
      startDate: startDate.toISOString(),
      expiresAt: expiresAt.toISOString(),
      autoRenew: true,
      status: "active",
    })
  })
})
