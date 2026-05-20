import type { NotificationScreen } from "@/features/notifications/types";

/** FCM `data` keys the Flutter app reads for notification tap navigation. */
export const FCM_DATA_KEYS = {
  type: "type",
  screen: "screen",
  articleId: "articleId",
  articleTitle: "articleTitle",
  newsId: "newsId",
  newsTitle: "newsTitle",
  productId: "productId",
  link: "link",
} as const;

export type NavigationDataInput = {
  screen: NotificationScreen;
  articleId?: string;
  newsId?: string;
  productId?: string;
  link?: string;
  /** Extra string key/value pairs merged into FCM data. */
  extra?: Record<string, string>;
};

/**
 * Build FCM data payload for notification-click routing in Flutter.
 * All values are strings (FCM requirement).
 */
export function buildNavigationData(input: NavigationDataInput): Record<string, string> {
  const data: Record<string, string> = {
    [FCM_DATA_KEYS.type]: input.screen,
    [FCM_DATA_KEYS.screen]: input.screen,
  };

  if (input.articleId) data[FCM_DATA_KEYS.articleId] = input.articleId;
  if (input.newsId) data[FCM_DATA_KEYS.newsId] = input.newsId;
  if (input.productId) data[FCM_DATA_KEYS.productId] = input.productId;
  if (input.link) data[FCM_DATA_KEYS.link] = input.link;

  if (input.extra) {
    for (const [key, value] of Object.entries(input.extra)) {
      if (value != null && value !== "") data[key] = String(value);
    }
  }

  return data;
}

export function buildArticleNotificationData(
  articleId: string,
  articleTitle?: string
): Record<string, string> {
  const data = buildNavigationData({
    screen: "article",
    articleId,
    link: `/articles/${articleId}`,
  });
  if (articleTitle?.trim()) {
    data[FCM_DATA_KEYS.articleTitle] = articleTitle.trim();
  }
  return data;
}

export function buildNewsNotificationData(
  newsId: string,
  newsTitle?: string
): Record<string, string> {
  const data = buildNavigationData({
    screen: "news",
    newsId,
    link: `/news/${newsId}`,
  });
  if (newsTitle?.trim()) {
    data[FCM_DATA_KEYS.newsTitle] = newsTitle.trim();
  }
  return data;
}
