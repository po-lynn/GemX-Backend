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
const { QueryTimeoutError } = await import("@/lib/query-timeout");

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

  // Validates the timeout guard: a hung preview query fails fast with a retryable 503
  // instead of a fake `conversations: []` (which would misleadingly read as "all caught up"
  // while the separately-sourced bell badge count still shows unread messages).
  it("returns 503 with Retry-After when the query hangs past the timeout", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: "user-abc" },
      } as never);
      vi.mocked(getUnreadConversationPreviews).mockReturnValue(new Promise(() => {}));

      const resPromise = GET(makeRequest());
      await vi.advanceTimersByTimeAsync(6000);
      const res = await resPromise;

      expect(res.status).toBe(503);
      expect(res.headers.get("Retry-After")).toBe("3");
      const data = await res.json();
      expect(data.error).toMatch(/retry/i);
    } finally {
      vi.useRealTimers();
    }
  });

  // Validates a QueryTimeoutError specifically maps to 503, not the generic 500 path.
  it("returns 503 when getUnreadConversationPreviews rejects with QueryTimeoutError", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-abc" },
    } as never);
    vi.mocked(getUnreadConversationPreviews).mockRejectedValue(
      new QueryTimeoutError("chat-unread-preview", 6000)
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
  });
});
