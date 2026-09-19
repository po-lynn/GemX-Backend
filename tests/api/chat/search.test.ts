import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/chat/db/message-search", () => ({
  searchChatMessages: vi.fn(),
}));

const { auth } = await import("@/lib/auth");
const { searchChatMessages } = await import("@/features/chat/db/message-search");
const { GET } = await import("@/app/api/chat/search/route");
const { QueryTimeoutError } = await import("@/lib/query-timeout");

function makeRequest(qs: string): NextRequest {
  return new Request(`http://localhost/api/chat/search${qs}`) as unknown as NextRequest;
}

describe("GET /api/chat/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "me-1" } } as never);
  });

  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(makeRequest("?q=sapphire"));
    expect(res.status).toBe(401);
    expect(searchChatMessages).not.toHaveBeenCalled();
  });

  it("returns 400 when q is missing", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(400);
    expect(searchChatMessages).not.toHaveBeenCalled();
  });

  it("returns 400 when q is a single character", async () => {
    const res = await GET(makeRequest("?q=a"));
    expect(res.status).toBe(400);
  });

  it("searches across all peers with default paging when peerId is omitted", async () => {
    vi.mocked(searchChatMessages).mockResolvedValue({ results: [], total: 0 });

    const res = await GET(makeRequest("?q=sapphire"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(searchChatMessages).toHaveBeenCalledWith("me-1", "sapphire", {
      peerId: undefined,
      page: 1,
      limit: 30,
    });
    expect(json).toEqual({ success: true, results: [], total: 0, page: 1, limit: 30 });
  });

  it("scopes the search to one peer and forwards custom paging", async () => {
    const results = [
      {
        id: "msg-1",
        peerId: "peer-1",
        peerName: "Peer",
        peerImage: null,
        content: "sapphire deal",
        messageType: "text",
        createdAt: "2026-08-01T00:00:00.000Z",
      },
    ];
    vi.mocked(searchChatMessages).mockResolvedValue({ results, total: 1 });

    const res = await GET(makeRequest("?q=sapphire&peerId=peer-1&page=2&limit=10"));
    const json = await res.json();

    expect(searchChatMessages).toHaveBeenCalledWith("me-1", "sapphire", {
      peerId: "peer-1",
      page: 2,
      limit: 10,
    });
    expect(json.results).toEqual(results);
  });

  it("returns 503 with Retry-After when the search query hangs past the timeout", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(searchChatMessages).mockReturnValue(new Promise(() => {}));

      const resPromise = GET(makeRequest("?q=sapphire"));
      await vi.advanceTimersByTimeAsync(6000);
      const res = await resPromise;

      expect(res.status).toBe(503);
      expect(res.headers.get("Retry-After")).toBe("3");
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns 503 when searchChatMessages rejects with QueryTimeoutError", async () => {
    vi.mocked(searchChatMessages).mockRejectedValue(new QueryTimeoutError("chat-search", 6000));
    const res = await GET(makeRequest("?q=sapphire"));
    expect(res.status).toBe(503);
  });

  it("returns 500 when the search throws a non-timeout error", async () => {
    vi.mocked(searchChatMessages).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("?q=sapphire"));
    expect(res.status).toBe(500);
  });

  // Uses a unique session user id (not "me-1", shared by every other test in this file)
  // so this test's 20+ calls against the shared in-memory rate-limit store can't leak
  // into or be affected by other tests — same convention as tests/api/contact.test.ts's
  // rate-limit test.
  it("rate-limits repeated searches from the same user", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "rate-limit-search-user" } } as never);
    vi.mocked(searchChatMessages).mockResolvedValue({ results: [], total: 0 });

    for (let i = 0; i < 20; i++) {
      const res = await GET(makeRequest("?q=sapphire"));
      expect(res.status).toBe(200);
    }

    const limited = await GET(makeRequest("?q=sapphire"));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });
});
