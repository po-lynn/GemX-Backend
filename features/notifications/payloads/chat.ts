import { getDirectConversationId } from "@/features/chat/lib/conversation-id";
import type { NotificationScreen } from "@/features/notifications/types";

const CHAT_FCM_DATA_KEYS = {
  type: "type",
  screen: "screen",
  senderId: "senderId",
  conversationId: "conversationId",
  messageId: "messageId",
  link: "link",
} as const;

export type ChatMessageNotificationDataInput = {
  senderId: string;
  recipientId: string;
  messageId: string;
};

/** FCM data for chat message tap → open conversation with sender. */
export function buildChatMessageNotificationData(
  input: ChatMessageNotificationDataInput
): Record<string, string> {
  const conversationId = getDirectConversationId(input.senderId, input.recipientId);
  const screen: NotificationScreen = "chat";

  return {
    [CHAT_FCM_DATA_KEYS.type]: "chat_message",
    [CHAT_FCM_DATA_KEYS.screen]: screen,
    [CHAT_FCM_DATA_KEYS.senderId]: input.senderId,
    [CHAT_FCM_DATA_KEYS.conversationId]: conversationId,
    [CHAT_FCM_DATA_KEYS.messageId]: input.messageId,
    [CHAT_FCM_DATA_KEYS.link]: `/chat/${input.senderId}`,
  };
}
