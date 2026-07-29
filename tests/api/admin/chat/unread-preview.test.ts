import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/chat/db/admin-all-conversations", () => ({
  getAdminChatLastSeenAt: vi.fn(),
  getNewConversationsForAdmin: vi.fn(),
}));

const { auth } = await import("@/lib/auth");
const { getAdminChatLastSeenAt, getNewConversationsForAdmin } = await import(
  "@/features/chat/db/admin-all-conversations"
);
const { GET } = await import("@/app/api/admin/chat/unread/preview/route");

function makeRequest(): NextRequest {
  return new Request("http://localhost/api/admin/chat/unread/preview") as unknown as NextRequest;
}

describe("GET /api/admin/chat/unread/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Validates the auth boundary: no session → 401, no DB query.
  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(getNewConversationsForAdmin).not.toHaveBeenCalled();
  });

  // Validates the strict admin-only gate, matching the sibling /unread endpoint.
  it("returns 403 for role internal", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "staff-1", role: "internal" },
    } as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(getNewConversationsForAdmin).not.toHaveBeenCalled();
  });

  // Validates the happy path: cursor is read first, then handed to the list query.
  it("returns conversations with new activity since the admin's last-seen cursor", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never);
    const since = new Date("2026-07-20T00:00:00.000Z");
    vi.mocked(getAdminChatLastSeenAt).mockResolvedValue(since);
    const conversations = [
      {
        participants: [
          { id: "user-a", name: "Alice", image: null, role: "user" },
          { id: "user-b", name: "Bob", image: null, role: "user" },
        ],
        lastMessage: "hey",
        lastMessageTime: "2026-07-21T00:00:00.000Z",
        lastMessageType: "text",
      },
    ];
    vi.mocked(getNewConversationsForAdmin).mockResolvedValue(conversations as never);

    const res = await GET(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, conversations });
    expect(getNewConversationsForAdmin).toHaveBeenCalledWith("admin-1", since);
  });

  // Validates a query failure surfaces as a 500 rather than an unhandled rejection.
  it("returns 500 when the query throws", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never);
    vi.mocked(getAdminChatLastSeenAt).mockResolvedValue(new Date(0));
    vi.mocked(getNewConversationsForAdmin).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
