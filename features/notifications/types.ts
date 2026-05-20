import type { PushNotificationError } from "@/features/notifications/errors";

/** Platform values accepted for device registration. */
export type DevicePlatform = "android" | "ios";

/** Input for registering or updating a user's device. */
export type RegisterUserDeviceInput = {
  userId: string;
  fcmToken: string;
  platform?: DevicePlatform | null;
  deviceId?: string | null;
  deviceName?: string | null;
  deviceModel?: string | null;
  osVersion?: string | null;
  appVersion?: string | null;
};

/** Stored user device row (subset used by services). */
export type UserDeviceRecord = {
  id: string;
  userId: string;
  fcmToken: string;
  platform: string | null;
  deviceId: string | null;
  deviceName: string | null;
  deviceModel: string | null;
  osVersion: string | null;
  appVersion: string | null;
  lastActiveAt: Date;
};

/** FCM notification payload. */
export type PushNotificationPayload = {
  title: string;
  body?: string;
  /** Custom data for deep linking (values must be strings for FCM). */
  data?: Record<string, string>;
};

/** Result of a multicast send operation. */
export type PushSendResult = {
  sent: number;
  failed: number;
  /** Tokens that FCM rejected as invalid (pruned from DB). */
  invalidTokensRemoved: number;
};

/** Auth lifecycle notification kinds. */
export type AuthNotificationType = "welcome" | "login";

/** Screens the app opens when a notification is tapped. */
export type NotificationScreen =
  | "home"
  | "article"
  | "news"
  | "profile"
  | "product"
  | "chat"
  | "custom";

/** Result of sending to an FCM topic (single message). */
export type TopicPushResult =
  | { success: true; messageId: string; topic: string }
  | { success: false; error: PushNotificationError };

/** Typed article publish notification input. */
export type ArticlePublishedNotificationInput = {
  articleId: string;
  title: string;
};

/** Typed news publish notification input. */
export type NewsPublishedNotificationInput = {
  newsId: string;
  title: string;
};

/** Input for chat message push to a single receiver. */
export type ChatMessageNotificationInput = {
  messageId: string;
  senderId: string;
  recipientId: string;
  senderName?: string | null;
  preview: string;
};

export type ChatMessageNotificationResult = {
  sent: boolean;
  skipped: boolean;
  skipReason?: "receiver_viewing_chat" | "no_devices" | "fcm_not_configured";
  pushResult?: PushSendResult;
};
