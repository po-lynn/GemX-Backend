import type { MessagePayload } from "firebase/messaging";

/** Parsed FCM data used for in-app / web navigation. */
export type NotificationNavigationPayload = {
  screen?: string;
  articleId?: string;
  articleTitle?: string;
  newsId?: string;
  newsTitle?: string;
  productId?: string;
  senderId?: string;
  conversationId?: string;
  messageId?: string;
  link?: string;
};

export type WebPushInitResult =
  | { ok: true; token: string }
  | { ok: false; reason: "unsupported" | "denied" | "not_configured" | "error"; message?: string };

export type FcmMessageHandler = (payload: MessagePayload) => void;
