import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/push/global/route";
import { auth } from "@/lib/auth";

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/features/notifications/services/global-push", () => ({
  sendAdminGlobalNotification: vi.fn(),
}));

const { sendAdminGlobalNotification } = await import(
  "@/features/notifications/services/global-push"
);

function mockRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/admin/push/global", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe("POST /api/admin/push/global", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never);
  });

  it("returns 401 without admin session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const res = await POST(mockRequest({ title: "Hi" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when article screen lacks articleId", async () => {
    const res = await POST(mockRequest({ title: "Hi", screen: "article" }));
    expect(res.status).toBe(400);
    expect(sendAdminGlobalNotification).not.toHaveBeenCalled();
  });

  it("sends global notification for valid admin body", async () => {
    vi.mocked(sendAdminGlobalNotification).mockResolvedValue({
      success: true,
      messageId: "msg-1",
      topic: "global",
    });

    const res = await POST(
      mockRequest({
        title: "Sale",
        body: "Limited time",
        screen: "home",
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(sendAdminGlobalNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Sale", screen: "home" })
    );
  });
});
