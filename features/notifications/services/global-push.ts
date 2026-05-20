"use server";

import { FCM_GLOBAL_TOPIC } from "@/features/notifications/constants";
import {
  buildArticleNotificationData,
  buildNewsNotificationData,
  buildNavigationData,
} from "@/features/notifications/payloads/navigation";
import { sendPushToTopic } from "@/features/notifications/services/send-topic-notification";
import type {
  ArticlePublishedNotificationInput,
  NewsPublishedNotificationInput,
  NotificationScreen,
  PushNotificationPayload,
  TopicPushResult,
} from "@/features/notifications/types";

/**
 * Broadcast to all devices subscribed to the global topic.
 * No user authentication or device token registration required on the client.
 */
export async function sendGlobalPushNotification(
  payload: PushNotificationPayload
): Promise<TopicPushResult> {
  return sendPushToTopic(FCM_GLOBAL_TOPIC, payload);
}

/** Article published — includes articleId for Flutter deep link. */
export async function sendArticlePublishedNotification(
  input: ArticlePublishedNotificationInput
): Promise<TopicPushResult> {
  return sendGlobalPushNotification({
    title: "New article",
    body: input.title,
    data: buildArticleNotificationData(input.articleId),
  });
}

/** News published — includes newsId for Flutter deep link. */
export async function sendNewsPublishedNotification(
  input: NewsPublishedNotificationInput
): Promise<TopicPushResult> {
  return sendGlobalPushNotification({
    title: "New news",
    body: input.title,
    data: buildNewsNotificationData(input.newsId),
  });
}

/** Admin-composed broadcast with explicit navigation target. */
export async function sendAdminGlobalNotification(input: {
  title: string;
  body?: string;
  screen?: NotificationScreen;
  articleId?: string;
  newsId?: string;
  productId?: string;
  link?: string;
  extraData?: Record<string, string>;
}): Promise<TopicPushResult> {
  const screen = input.screen ?? "home";
  const data = buildNavigationData({
    screen,
    articleId: input.articleId,
    newsId: input.newsId,
    productId: input.productId,
    link: input.link,
    extra: input.extraData,
  });

  return sendGlobalPushNotification({
    title: input.title,
    body: input.body,
    data,
  });
}
