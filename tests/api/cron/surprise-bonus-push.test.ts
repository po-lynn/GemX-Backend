import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/features/points/services/surprise-bonus-push", () => ({
  sendSurpriseBonusPushToUsers: vi.fn(),
}))

import { sendSurpriseBonusPushToUsers } from "@/features/points/services/surprise-bonus-push"
import { POST } from "@/app/api/cron/surprise-bonus-push/route"

describe("POST /api/cron/surprise-bonus-push", () => {
  const originalSecret = process.env.CRON_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = "test-cron-secret"
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalSecret
  })

  it("returns 401 without bearer secret", async () => {
    const req = new NextRequest("http://localhost/api/cron/surprise-bonus-push", {
      method: "POST",
      body: JSON.stringify({
        userIds: ["u1"],
        campaignId: "camp-1",
        campaignName: "Sweet December",
        pointsPerUser: 500,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("sends push for newly granted users", async () => {
    // Edge Function proxies here after surprise_bonus_batch grants
    vi.mocked(sendSurpriseBonusPushToUsers).mockResolvedValue({
      sent: 1,
      failed: 0,
      invalidTokensRemoved: 0,
    })

    const req = new NextRequest("http://localhost/api/cron/surprise-bonus-push", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-cron-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userIds: ["u1"],
        campaignId: "camp-1",
        campaignName: "Sweet December",
        pointsPerUser: 500,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.sent).toBe(1)
    expect(sendSurpriseBonusPushToUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ["u1"],
        campaignId: "camp-1",
        pointsPerUser: 500,
      }),
    )
  })
})
