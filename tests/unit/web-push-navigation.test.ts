import { describe, expect, it } from "vitest";
import {
  parseNotificationData,
  resolveNotificationPath,
} from "@/lib/notifications/navigation";

describe("web push navigation", () => {
  it("routes article notifications to article detail page", () => {
    const data = parseNotificationData({
      screen: "article",
      articleId: "11111111-1111-1111-1111-111111111111",
      articleTitle: "Ruby Guide",
    });
    expect(resolveNotificationPath(data)).toBe(
      "/articles/11111111-1111-1111-1111-111111111111"
    );
    expect(data.articleTitle).toBe("Ruby Guide");
  });

  it("routes news notifications to news detail page", () => {
    const data = parseNotificationData({
      screen: "news",
      newsId: "22222222-2222-2222-2222-222222222222",
      newsTitle: "Market Update",
    });
    expect(resolveNotificationPath(data)).toBe(
      "/news/22222222-2222-2222-2222-222222222222"
    );
    expect(data.newsTitle).toBe("Market Update");
  });

  it("falls back to home when no screen match", () => {
    expect(resolveNotificationPath({})).toBe("/");
  });
});
