import type { NotificationNavigationPayload } from "@/lib/notifications/types";

/** Parse FCM `data` map into a typed navigation payload. */
export function parseNotificationData(
  data: Record<string, string> | undefined
): NotificationNavigationPayload {
  if (!data) return {};
  return {
    screen: data.screen,
    articleId: data.articleId,
    articleTitle: data.articleTitle,
    newsId: data.newsId,
    newsTitle: data.newsTitle,
    productId: data.productId,
    link: data.link,
  };
}

/**
 * Resolve in-app path for notification click (web React router).
 * Article detail: `/articles/:articleId`
 */
export function resolveNotificationPath(payload: NotificationNavigationPayload): string {
  if (payload.screen === "article" && payload.articleId) {
    return `/articles/${payload.articleId}`;
  }
  if (payload.screen === "news" && payload.newsId) {
    return `/news/${payload.newsId}`;
  }
  if (payload.screen === "product" && payload.productId) {
    return `/products/${payload.productId}`;
  }
  if (payload.link?.startsWith("/")) {
    return payload.link;
  }
  return "/";
}
