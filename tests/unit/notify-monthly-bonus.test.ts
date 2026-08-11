import { beforeEach, describe, expect, it, vi } from "vitest"

const insertReturning = vi.fn()
const insertValues = vi.fn(() => ({ returning: insertReturning }))
const insert = vi.fn(() => ({ values: insertValues }))

vi.mock("@/drizzle/db", () => ({
  db: { insert },
}))

vi.mock("@/features/notifications/services/chat-notifications", () => ({
  sendChatMessageNotification: vi.fn().mockResolvedValue({ sent: true }),
}))

vi.mock("@/lib/supabase/chat-broadcast", () => ({
  broadcastChatEvents: vi.fn().mockResolvedValue(undefined),
}))

import { GEMX_NOTIFICATIONS_SYSTEM_USER_ID } from "@/features/points/constants/monthly-bonus-notify"
import { notifyMonthlyBonusGranted } from "@/features/points/services/notify-monthly-bonus"
import { sendChatMessageNotification } from "@/features/notifications/services/chat-notifications"
import { broadcastChatEvents } from "@/lib/supabase/chat-broadcast"

describe("notifyMonthlyBonusGranted", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertReturning.mockResolvedValue([
      {
        id: "msg-1",
        senderId: GEMX_NOTIFICATIONS_SYSTEM_USER_ID,
        recipientId: "user-1",
        content: "title\n\nbody",
        fileUrl: null,
        imageUrls: null,
        messageType: "text",
        isRead: false,
        starred: false,
        editedAt: null,
        createdAt: new Date("2023-10-01T00:00:00Z"),
      },
    ])
  })

  it("inserts a GemX chat message and fires push + broadcast", async () => {
    // Happy path: credit notify delivers chat row with branded push title.
    await notifyMonthlyBonusGranted({ userId: "user-1", amount: 100 })

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: GEMX_NOTIFICATIONS_SYSTEM_USER_ID,
        recipientId: "user-1",
        messageType: "text",
        content: expect.stringContaining(
          "Your monthly bonus points have arrived!",
        ),
      }),
    )
    expect(sendChatMessageNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "msg-1",
        senderId: GEMX_NOTIFICATIONS_SYSTEM_USER_ID,
        recipientId: "user-1",
        title: "Your monthly bonus points have arrived! 🗓️",
        preview: expect.stringContaining("100 points"),
      }),
    )
    expect(broadcastChatEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "user-1",
        event: "new_message",
      }),
    ])
  })

  it("swallows insert failures so grants are not blocked", async () => {
    // Notification errors must never surface to the grant loop.
    insertReturning.mockRejectedValueOnce(new Error("fk missing"))
    await expect(
      notifyMonthlyBonusGranted({ userId: "user-1", amount: 100 }),
    ).resolves.toBeUndefined()
    expect(sendChatMessageNotification).not.toHaveBeenCalled()
  })
})
