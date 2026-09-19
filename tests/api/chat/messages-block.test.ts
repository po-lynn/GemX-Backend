import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Validates that a self-service block (features/chat/db/blocks.ts) stops a send in
// either direction — the recipient blocked the sender, or the sender blocked the
// recipient — before any recipient-existence or rate-limit query runs.

vi.mock("next/server", () => ({ connection: vi.fn(), after: vi.fn((fn: () => unknown) => fn()) }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/drizzle/db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock("@/features/notifications/services/chat-notifications", () => ({
  sendChatMessageNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/chat-broadcast", () => ({
  broadcastChatEvents: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/chat-moderation/db/restrictions", () => ({
  getActiveRestriction: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/features/chat/db/blocks", () => ({
  isBlockedEitherDirection: vi.fn(),
}));

const { auth } = await import("@/lib/auth");
const { db } = await import("@/drizzle/db");
const { isBlockedEitherDirection } = await import("@/features/chat/db/blocks");
const { POST } = await import("@/app/api/chat/messages/route");

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/chat/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/chat/messages block enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "sender-1", name: "Sender" },
    } as never);
  });

  it("returns 403 and never queries the recipient when either party has blocked the other", async () => {
    vi.mocked(isBlockedEitherDirection).mockResolvedValue(true);

    const res = await POST(makeRequest({ recipientId: "recipient-1", content: "hello" }));

    expect(res.status).toBe(403);
    expect(isBlockedEitherDirection).toHaveBeenCalledWith("sender-1", "recipient-1");
    expect(db.select).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("checks blocks using both the sender and recipient ids, regardless of who blocked whom", async () => {
    vi.mocked(isBlockedEitherDirection).mockResolvedValue(true);

    await POST(makeRequest({ recipientId: "recipient-1", content: "hello" }));

    // isBlockedEitherDirection itself owns the "either direction" semantics (see its
    // own unit test) — this only verifies the route passes both ids through untouched.
    expect(isBlockedEitherDirection).toHaveBeenCalledWith("sender-1", "recipient-1");
  });
});
