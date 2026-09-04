import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, connection } from "next/server"

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>()
  return { ...actual, connection: vi.fn() }
})

vi.mock("@/lib/api-guard", () => ({
  requireAdminOrFeature: vi.fn(),
}))

vi.mock("@/features/points/db/surprise-bonus", () => ({
  getSurpriseBonusCampaignById: vi.fn(),
}))

import { requireAdminOrFeature } from "@/lib/api-guard"
import { getSurpriseBonusCampaignById } from "@/features/points/db/surprise-bonus"
import { GET } from "@/app/api/admin/points/surprise-bonus/[id]/route"

describe("GET /api/admin/points/surprise-bonus/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
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
