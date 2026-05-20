import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/chat/db/active-chat-view", () => ({
  isUserViewingPeer: vi.fn(),
}));

vi.mock("@/features/notifications/services/send-push-notification", () => ({
  sendPushNotificationToUserIds: vi.fn(),
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ name: "Alice" }]),
        })),
      })),
    })),
  },
}));

const { isUserViewingPeer } = await import("@/features/chat/db/active-chat-view");
const { sendPushNotificationToUserIds } = await import(
  "@/features/notifications/services/send-push-notification"
);
const { sendChatMessageNotification } = await import(
  "@/features/notifications/services/chat-notifications"
);

describe("sendChatMessageNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isUserViewingPeer).mockResolvedValue(false);
    vi.mocked(sendPushNotificationToUserIds).mockResolvedValue({
      sent: 1,
      failed: 0,
      invalidTokensRemoved: 0,
    });
  });

  it("skips push when receiver is viewing the same chat", async () => {
    vi.mocked(isUserViewingPeer).mockResolvedValue(true);

    const result = await sendChatMessageNotification({
      messageId: "m1",
      senderId: "s1",
      recipientId: "r1",
      preview: "Hello",
    });

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe("receiver_viewing_chat");
    expect(sendPushNotificationToUserIds).not.toHaveBeenCalled();
  });

  it("sends push only to recipient with senderId and conversationId in data", async () => {
    const result = await sendChatMessageNotification({
      messageId: "m2",
      senderId: "s2",
      recipientId: "r2",
      senderName: "Bob",
      preview: "Hi there",
    });

    expect(result.sent).toBe(true);
    expect(sendPushNotificationToUserIds).toHaveBeenCalledWith(
      ["r2"],
      expect.objectContaining({
        title: "Bob",
        body: "Hi there",
        data: expect.objectContaining({
          senderId: "s2",
          conversationId: expect.any(String),
          messageId: "m2",
          screen: "chat",
        }),
      })
    );
  });
});
