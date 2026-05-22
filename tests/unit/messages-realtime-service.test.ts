import { describe, expect, it } from "vitest";
import { normalizeChatMessageRow } from "@/features/chat/types/message";
import { buildChatMessageNotificationData } from "@/features/notifications/payloads/chat";
import { getDirectConversationId } from "@/features/chat/lib/conversation-id";

describe("chat realtime message row", () => {
  it("normalizes snake_case Supabase payload", () => {
    const row = normalizeChatMessageRow({
      id: "msg-1",
      sender_id: "user-a",
      recipient_id: "admin-1",
      content: "Hello",
      is_read: false,
      created_at: "2026-01-01T00:00:00.000Z",
      message_type: "text",
    });
    expect(row.senderId).toBe("user-a");
    expect(row.recipientId).toBe("admin-1");
    expect(row.isRead).toBe(false);
  });
});

describe("getDirectConversationId", () => {
  it("matches chat notification conversationId", () => {
    const id = getDirectConversationId("a", "b");
    const data = buildChatMessageNotificationData({
      senderId: "a",
      recipientId: "b",
      messageId: "m1",
    });
    expect(data.conversationId).toBe(id);
  });
});
