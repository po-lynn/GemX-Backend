import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/drizzle/db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock("@/features/notifications/services/chat-notifications", () => ({
  sendChatMessageNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/chat-broadcast", () => ({
  broadcastChatEvents: vi.fn().mockResolvedValue(undefined),
}));

const { auth } = await import("@/lib/auth");
const { db } = await import("@/drizzle/db");
const { POST } = await import("@/app/api/chat/messages/route");

/** Thenable select-chain mock: resolves to `result` wherever the chain is awaited. */
function selectChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function insertChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(result));
  return chain;
}

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/chat/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const savedRow = {
  id: "msg-1",
  senderId: "sender-1",
  recipientId: "recipient-1",
  content: "hello",
  fileUrl: null,
  imageUrls: null,
  messageType: "text",
  isRead: false,
  starred: false,
  editedAt: null,
  createdAt: new Date("2026-07-05T00:00:00.000Z"),
};

describe("POST /api/chat/messages send rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "sender-1", name: "Sender" },
    } as never);
  });

  // Validates the sliding-window limit: 30+ messages in the last 60s → 429, no insert.
  it("returns 429 and skips the insert when the sender exceeds the window", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([{ id: "recipient-1" }]) as never) // recipient lookup
      .mockReturnValueOnce(selectChain([{ count: 30 }]) as never); // recent-send count

    const res = await POST(makeRequest({ recipientId: "recipient-1", content: "hello" }));
    expect(res.status).toBe(429);
    expect(db.insert).not.toHaveBeenCalled();
  });

  // Validates the happy path is unaffected below the limit.
  it("saves the message when the sender is under the limit", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([{ id: "recipient-1" }]) as never)
      .mockReturnValueOnce(selectChain([{ count: 5 }]) as never);
    vi.mocked(db.insert).mockReturnValue(insertChain([savedRow]) as never);

    const res = await POST(makeRequest({ recipientId: "recipient-1", content: "hello" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.message.id).toBe("msg-1");
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  // Validates that a missing recipient still 404s (rate check must not mask it).
  it("returns 404 for unknown recipient even when rate count is high", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([]) as never)
      .mockReturnValueOnce(selectChain([{ count: 99 }]) as never);

    const res = await POST(makeRequest({ recipientId: "ghost", content: "hello" }));
    expect(res.status).toBe(404);
    expect(db.insert).not.toHaveBeenCalled();
  });

  // Validates auth gating is unchanged.
  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await POST(makeRequest({ recipientId: "recipient-1", content: "hello" }));
    expect(res.status).toBe(401);
    expect(db.select).not.toHaveBeenCalled();
  });
});
