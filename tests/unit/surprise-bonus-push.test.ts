import { describe, expect, it, vi } from "vitest"

vi.mock("@/features/notifications/services/send-push-notification", () => ({
  sendPushNotificationToUserIds: vi.fn().mockResolvedValue({
    sent: 2,
    failed: 0,
    invalidTokensRemoved: 0,
  }),
}))

import { sendPushNotificationToUserIds } from "@/features/notifications/services/send-push-notification"
import {
  buildSurpriseBonusPushPayload,
  sendSurpriseBonusPushToUsers,
} from "@/features/points/services/surprise-bonus-push"

describe("buildSurpriseBonusPushPayload", () => {
  it("matches app_notification title/body and includes campaign data", () => {
    // Same copy as grant_surprise_bonus_user RPC notification insert
    expect(
      buildSurpriseBonusPushPayload({
        campaignId: "camp-1",
        campaignName: "Sweet December",
        pointsPerUser: 500,
      }),
    ).toEqual({
      title: "Sweet December 🎁",
      body: "You received 500 surprise bonus points!",
      data: {
        type: "surprise_bonus",
        screen: "home",
        campaignId: "camp-1",
        points: "500",
      },
    })
  })
})

describe("sendSurpriseBonusPushToUsers", () => {
  it("sends FCM to unique user ids with surprise bonus payload", async () => {
    const result = await sendSurpriseBonusPushToUsers({
      userIds: ["u1", "u1", "u2"],
      campaignId: "camp-1",
      campaignName: "Sweet December",
      pointsPerUser: 500,
    })

    expect(sendPushNotificationToUserIds).toHaveBeenCalledWith(
      ["u1", "u2"],
      expect.objectContaining({
        title: "Sweet December 🎁",
        data: expect.objectContaining({ type: "surprise_bonus", campaignId: "camp-1" }),
      }),
    )
    expect(result.sent).toBe(2)
  })

  it("no-ops when userIds empty", async () => {
    vi.mocked(sendPushNotificationToUserIds).mockClear()
    const result = await sendSurpriseBonusPushToUsers({
      userIds: [],
      campaignId: "camp-1",
      campaignName: "X",
      pointsPerUser: 1,
    })
    expect(sendPushNotificationToUserIds).not.toHaveBeenCalled()
    expect(result).toEqual({ sent: 0, failed: 0, invalidTokensRemoved: 0 })
  })
})
