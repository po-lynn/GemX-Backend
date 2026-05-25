import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { getActivePremiumDealers } from "@/features/points/db/points"
import { getPublicProfilePresenceMap } from "@/features/users/db/profile-presence"
import { GET } from "@/app/api/mobile/premium-dealers/route"

vi.mock("next/server", () => ({
  connection: vi.fn(),
}))
vi.mock("@/features/points/db/points", () => ({
  getActivePremiumDealers: vi.fn(),
}))
vi.mock("@/features/users/db/profile-presence", () => ({
  getPublicProfilePresenceMap: vi.fn(),
}))

describe("GET /api/mobile/premium-dealers", () => {
  const premiumSince = new Date("2024-03-10T08:00:00.000Z")
  const currentStart = new Date("2026-04-16T10:00:00.000Z")
  const expiresAt = new Date("2026-05-16T10:00:00.000Z")

  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getActivePremiumDealers).mockResolvedValue([
      {
        userId: "user-1",
        name: "Jane",
        username: "jane",
        image: null,
        city: "Yangon",
        ratingScore: 4.5,
        firstPremiumDealerYear: 2024,
        premiumSinceDate: premiumSince,
        packageName: "Basic",
        startDate: currentStart,
        expiresAt,
        autoRenew: false,
      },
    ])
    vi.mocked(getPublicProfilePresenceMap).mockResolvedValue(
      new Map([
        [
          "user-1",
          { presence: "online" as const, status: "Online", lastSeenAt: null },
        ],
      ])
    )
  })

  it("returns premiumSinceDate as ISO string from earliest package start_date", async () => {
    const req = new Request("http://localhost/api/mobile/premium-dealers")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.premiumDealers[0].premiumSinceDate).toBe(premiumSince.toISOString())
    expect(data.premiumDealers[0].startDate).toBe(currentStart.toISOString())
  })

  it("serializes premiumSinceDate when db returns an ISO string (SQL subquery)", async () => {
    vi.mocked(getActivePremiumDealers).mockResolvedValue([
      {
        userId: "user-1",
        name: "Jane",
        username: "jane",
        image: null,
        city: null,
        ratingScore: 0,
        firstPremiumDealerYear: 2024,
        premiumSinceDate: "2024-03-10T08:00:00.000Z" as unknown as Date,
        packageName: "Basic",
        startDate: currentStart,
        expiresAt,
        autoRenew: false,
      },
    ])
    const req = new Request("http://localhost/api/mobile/premium-dealers")
    const res = await GET(req as NextRequest)
    const data = await res.json()
    expect(data.premiumDealers[0].premiumSinceDate).toBe("2024-03-10T08:00:00.000Z")
  })
})
