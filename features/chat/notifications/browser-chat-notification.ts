import { previewFromChatMessage, type ChatMessage } from "@/features/chat/types/message";
import { chatRealtimeLogger } from "@/features/chat/realtime/logger";

let permissionRequested = false;

export async function ensureChatNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  if (permissionRequested) return Notification.permission;
  permissionRequested = true;
  try {
    return await Notification.requestPermission();
  } catch (e) {
    chatRealtimeLogger.warn("Notification permission request failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return "denied";
  }
}

export type ShowChatBrowserNotificationInput = {
  message: ChatMessage;
  senderLabel?: string;
  /** Skip popup (e.g. user is viewing this thread). */
  suppress?: boolean;
};

export function showChatBrowserNotification(input: ShowChatBrowserNotificationInput): void {
  const { message, senderLabel, suppress } = input;
  if (suppress) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (message.recipientId === message.senderId) return;

  const title = senderLabel?.trim() || "New message";
  const body = previewFromChatMessage(message).slice(0, 180);
  const peerId = message.senderId;
  const url = `${window.location.origin}/admin/chat-dashboard?peer=${encodeURIComponent(peerId)}`;

  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: `chat-${peerId}`,
      data: { url, senderId: peerId, messageId: message.id },
    });
    n.onclick = () => {
      window.focus();
      window.location.href = url;
      n.close();
    };
    chatRealtimeLogger.info("Browser notification shown", { senderId: peerId, messageId: message.id });
  } catch (e) {
    chatRealtimeLogger.error("Browser notification failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
