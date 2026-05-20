import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { POST } from "@/app/api/push/global/subscribe/route";

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/features/notifications/services/topic-subscription", () => ({
  subscribeTokenToGlobalTopic: vi.fn(),
  unsubscribeTokenFromGlobalTopic: vi.fn(),
}));

const { subscribeTokenToGlobalTopic } = await import(
  "@/features/notifications/services/topic-subscription"
);

describe("POST /api/push/global/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("subscribes FCM token to global topic without auth", async () => {
    vi.mocked(subscribeTokenToGlobalTopic).mockResolvedValue({
      success: true,
      topic: "global",
      successCount: 1,
      failureCount: 0,
    });

    const req = new Request("http://localhost/api/push/global/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "web-fcm-token" }),
    }) as NextRequest;

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.topic).toBe("global");
    expect(subscribeTokenToGlobalTopic).toHaveBeenCalledWith("web-fcm-token");
  });

  it("returns 400 when token is missing", async () => {
    const req = new Request("http://localhost/api/push/global/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }) as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
