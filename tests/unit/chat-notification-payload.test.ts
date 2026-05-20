import { describe, expect, it } from "vitest";
import { getDirectConversationId } from "@/features/chat/lib/conversation-id";
import { buildChatMessageNotificationData } from "@/features/notifications/payloads/chat";

describe("getDirectConversationId", () => {
  it("is stable regardless of user order", () => {
    const a = "user-a";
    const b = "user-b";
    expect(getDirectConversationId(a, b)).toBe(getDirectConversationId(b, a));
  });
});

describe("buildChatMessageNotificationData", () => {
  it("includes senderId, conversationId, and messageId for navigation", () => {
    const data = buildChatMessageNotificationData({
      senderId: "sender-1",
      recipientId: "recipient-1",
      messageId: "msg-uuid",
    });
    expect(data.screen).toBe("chat");
    expect(data.type).toBe("chat_message");
    expect(data.senderId).toBe("sender-1");
    expect(data.messageId).toBe("msg-uuid");
    expect(data.conversationId).toBe(getDirectConversationId("sender-1", "recipient-1"));
    expect(data.link).toBe("/chat/sender-1");
  });
});
