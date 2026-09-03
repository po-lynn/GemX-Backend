import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/api-guard", () => ({
  requireAdminOrFeature: vi.fn(),
}))

vi.mock("@/features/points/services/enqueue-surprise-bonus", () => ({
  enqueueSurpriseBonusForAllUsers: vi.fn(),
}))

vi.mock("@/features/points/db/surprise-bonus", () => ({
  getSurpriseBonusCampaignById: vi.fn(),
}))

import { requireAdminOrFeature } from "@/lib/api-guard"
import { enqueueSurpriseBonusForAllUsers } from "@/features/points/services/enqueue-surprise-bonus"
import { getSurpriseBonusCampaignById } from "@/features/points/db/surprise-bonus"
import { POST } from "@/app/api/admin/points/surprise-bonus/route"
import { GET } from "@/app/api/admin/points/surprise-bonus/[id]/route"

describe("POST /api/admin/points/surprise-bonus", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdminOrFeature).mockResolvedValue({
      session: { user: { id: "admin-1", role: "admin" } },
    } as never)
  })

  it("returns 401 when unauthorized", async () => {
    vi.mocked(requireAdminOrFeature).mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as never)

    const req = new NextRequest("http://localhost/api/admin/points/surprise-bonus", {
      method: "POST",
      body: JSON.stringify({ campaignName: "Sweet December", pointsPerUser: 500 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("enqueues campaign and returns immediately", async () => {
    vi.mocked(enqueueSurpriseBonusForAllUsers).mockResolvedValue({
      success: true,
      campaignId: "camp-1",
      totalUsers: 100,
      pointsPerUser: 500,
      campaignName: "Sweet December",
    })

    const req = new NextRequest("http://localhost/api/admin/points/surprise-bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignName: "Sweet December", pointsPerUser: 500 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.campaignId).toBe("camp-1")
    expect(body.totalUsers).toBe(100)
    expect(enqueueSurpriseBonusForAllUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignName: "Sweet December",
        pointsPerUser: 500,
        createdBy: "admin-1",
      }),
    )
  })
})

describe("GET /api/admin/points/surprise-bonus/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdminOrFeature).mockResolvedValue({
      session: { user: { id: "admin-1", role: "admin" } },
    } as never)
  })

  it("returns campaign progress", async () => {
    vi.mocked(getSurpriseBonusCampaignById).mockResolvedValue({
      id: "camp-1",
      name: "Sweet December",
      pointsPerUser: 500,
      recipientType: "all_users",
      note: null,
      totalUsers: 10000,
      processedUsers: 6500,
      successCount: 6490,
      failedCount: 10,
      status: "processing",
      createdBy: "admin-1",
      startedAt: new Date("2026-08-24T00:00:00Z"),
      completedAt: null,
      createdAt: new Date("2026-08-24T00:00:00Z"),
      updatedAt: new Date("2026-08-24T00:10:00Z"),
    })

    const req = new NextRequest("http://localhost/api/admin/points/surprise-bonus/camp-1")
    const res = await GET(req, { params: Promise.resolve({ id: "camp-1" }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processedUsers).toBe(6500)
    expect(body.successCount).toBe(6490)
    expect(body.status).toBe("processing")
  })

  it("returns 404 when campaign missing", async () => {
    vi.mocked(getSurpriseBonusCampaignById).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/api/admin/points/surprise-bonus/missing")
    const res = await GET(req, { params: Promise.resolve({ id: "missing" }) })
    expect(res.status).toBe(404)
  })
})
