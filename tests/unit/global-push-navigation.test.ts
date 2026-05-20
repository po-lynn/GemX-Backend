import { describe, expect, it } from "vitest";
import {
  buildArticleNotificationData,
  buildNewsNotificationData,
  buildNavigationData,
} from "@/features/notifications/payloads/navigation";

describe("buildNavigationData", () => {
  // Flutter reads `screen` + ids from FCM data on notification tap.
  it("builds article navigation payload with articleId and title", () => {
    const data = buildArticleNotificationData(
      "11111111-1111-1111-1111-111111111111",
      "Ruby Guide"
    );
    expect(data.screen).toBe("article");
    expect(data.type).toBe("article");
    expect(data.articleId).toBe("11111111-1111-1111-1111-111111111111");
    expect(data.articleTitle).toBe("Ruby Guide");
    expect(data.link).toContain("11111111-1111-1111-1111-111111111111");
  });

  it("builds news navigation payload with newsId and title", () => {
    const data = buildNewsNotificationData(
      "22222222-2222-2222-2222-222222222222",
      "Market Update"
    );
    expect(data.screen).toBe("news");
    expect(data.newsId).toBe("22222222-2222-2222-2222-222222222222");
    expect(data.newsTitle).toBe("Market Update");
    expect(data.link).toContain("22222222-2222-2222-2222-222222222222");
  });

  it("merges extra string data for custom admin broadcasts", () => {
    const data = buildNavigationData({
      screen: "home",
      extra: { campaign: "spring-sale" },
    });
    expect(data.screen).toBe("home");
    expect(data.campaign).toBe("spring-sale");
  });
});
