import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/chat/db/admin-all-conversations", () => ({
  getConversationMessagesForAdmin: vi.fn(),
}));

const { auth } = await import("@/lib/auth");
const { getConversationMessagesForAdmin } = await import(
  "@/features/chat/db/admin-all-conversations"
);
const { GET } = await import("@/app/api/admin/chat/all-conversations/messages/route");

function makeRequest(query: string): NextRequest {
  return new Request(`http://localhost/api/admin/chat/all-conversations/messages${query}`) as unknown as NextRequest;
}

describe("GET /api/admin/chat/all-conversations/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Validates the endpoint is unauthenticated-safe: no session → 401, no DB query.
  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(makeRequest("?userA=a&userB=b"));
    expect(res.status).toBe(401);
    expect(getConversationMessagesForAdmin).not.toHaveBeenCalled();
  });

  // Validates the strict admin-only gate: role === "internal" (allowed on other chat
  // endpoints) must NOT see arbitrary users' conversations here.
  it("returns 403 for role internal, even though internal can use other chat endpoints", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "staff-1", role: "internal" },
    } as never);
    const res = await GET(makeRequest("?userA=a&userB=b"));
    expect(res.status).toBe(403);
    expect(getConversationMessagesForAdmin).not.toHaveBeenCalled();
  });

  // Validates the happy path for a true admin, including neither user being the caller.
  it("returns messages for role admin, for a pair not involving the caller", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never);
    vi.mocked(getConversationMessagesForAdmin).mockResolvedValue({
      messages: [
        {
          id: "m1",
          senderId: "user-a",
          recipientId: "user-b",
          content: "hi",
          fileUrl: null,
          imageUrls: null,
          messageType: "text",
          starred: false,
          createdAt: "2026-07-01T00:00:00.000Z",
        },
      ],
      total: 1,
    });

    const res = await GET(makeRequest("?userA=user-a&userB=user-b&page=1&limit=100"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.messages).toHaveLength(1);
    expect(json.total).toBe(1);
    expect(getConversationMessagesForAdmin).toHaveBeenCalledWith("user-a", "user-b", 1, 100);
  });

  // Validates the same-user guard rejects a degenerate pair before hitting the DB.
  it("returns 400 when userA equals userB", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never);
    const res = await GET(makeRequest("?userA=same&userB=same"));
    expect(res.status).toBe(400);
    expect(getConversationMessagesForAdmin).not.toHaveBeenCalled();
  });
});
