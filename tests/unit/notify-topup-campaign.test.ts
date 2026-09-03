import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/drizzle/db", () => ({
  db: {
    insert: vi.fn(),
  },
}))

vi.mock("@/features/notifications/services/chat-notifications", () => ({
  sendChatMessageNotification: vi.fn().mockResolvedValue({ sent: true }),
}))

vi.mock("@/lib/supabase/chat-broadcast", () => ({
  broadcastChatEvents: vi.fn().mockResolvedValue(undefined),
}))

import { db } from "@/drizzle/db"
import { sendChatMessageNotification } from "@/features/notifications/services/chat-notifications"
import { notifyTopUpCampaignGranted } from "@/features/points/services/notify-topup-campaign"

describe("notifyTopUpCampaignGranted", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const returning = vi.fn().mockResolvedValue([
      {
        id: "msg-1",
        senderId: "sys-gemx-notifications",
        recipientId: "user-1",
        content: "title\n\nbody",
        fileUrl: null,
        imageUrls: null,
        messageType: "text",
        isRead: false,
        starred: false,
        editedAt: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ])
    const values = vi.fn().mockReturnValue({ returning })
    vi.mocked(db.insert).mockReturnValue({ values } as never)
  })

  it("inserts a GemX chat message and triggers push notification", async () => {
    await notifyTopUpCampaignGranted({
      userId: "user-1",
      amount: 500,
      campaignName: "New Year Promo",
    })

    expect(db.insert).toHaveBeenCalled()
    expect(sendChatMessageNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "user-1",
        senderId: "sys-gemx-notifications",
        senderName: "GemX",
      }),
    )
  })
})
