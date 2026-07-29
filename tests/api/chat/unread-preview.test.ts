import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/chat/db/conversations-list", () => ({
  getUnreadConversationPreviews: vi.fn(),
}));

const { auth } = await import("@/lib/auth");
const { getUnreadConversationPreviews } = await import("@/features/chat/db/conversations-list");
const { GET } = await import("@/app/api/chat/unread/preview/route");

function makeRequest(): NextRequest {
  return new Request("http://localhost/api/chat/unread/preview") as unknown as NextRequest;
}

describe("GET /api/chat/unread/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Validates the auth boundary: no session means 401, and the DB is never touched.
  it("returns 401 when there is no session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(getUnreadConversationPreviews).not.toHaveBeenCalled();
  });

  // Validates the happy path: the session's user id is forwarded to the query,
  // and its result is returned as-is under `conversations`.
  it("returns the current user's unread conversation previews", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-abc" },
    } as never);
    const previews = [
      {
        userId: "peer-1",
        name: "Alice",
        profileImage: null,
        lastMessage: "hey",
        lastMessageTime: "2026-07-05T00:00:00.000Z",
        unreadCount: 2,
      },
    ];
    vi.mocked(getUnreadConversationPreviews).mockResolvedValue(previews as never);

    const res = await GET(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(getUnreadConversationPreviews).toHaveBeenCalledWith("user-abc");
    expect(data).toEqual({ success: true, conversations: previews });
  });

  // Validates that a query failure surfaces as a 500 rather than an unhandled rejection.
  it("returns 500 when the query throws", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-abc" },
    } as never);
    vi.mocked(getUnreadConversationPreviews).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
