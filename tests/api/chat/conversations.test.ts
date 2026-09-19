import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Validates the JSON-mode happy path, and — most importantly — that clampPollIntervalMs
// enforces a floor above the DB pooler's idle_timeout (drizzle/db.ts: 10s on the pooler
// path), regardless of what a client requests. This is the fix for the SSE connection-
// pinning finding: a poll interval shorter than idle_timeout means the connection backing
// the stream never goes idle long enough to be released back to the shared 15-connection
// pool. The mobile client hardcodes intervalMs=4000 today — this floor clamps that up to
// a safe value without requiring any mobile-side change.

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/chat/db/conversations-list", () => ({
  getChatActivitySignature: vi.fn(),
  getChatConversationsForUser: vi.fn(),
}));

const { auth } = await import("@/lib/auth");
const { getChatConversationsForUser } = await import("@/features/chat/db/conversations-list");
const { GET } = await import("@/app/api/chat/conversations/route");
const { clampPollIntervalMs } = await import("@/features/chat/lib/sse-poll-interval");

// This route reads `request.nextUrl.searchParams` (not `new URL(request.url)`, unlike most
// other routes in this codebase), so a plain Request needs `nextUrl` stubbed on top.
function makeRequest(qs = ""): NextRequest {
  const url = `http://localhost/api/chat/conversations${qs}`;
  const req = new Request(url) as unknown as NextRequest;
  Object.defineProperty(req, "nextUrl", { value: new URL(url) });
  return req;
}

describe("clampPollIntervalMs", () => {
  // The core fix: even a client requesting the old default (4000ms, which is what the
  // mobile app hardcodes today) gets clamped up to the new floor — no client update
  // required for the connection-pinning fix to take effect.
  it("clamps a request below the floor up to the floor", () => {
    expect(clampPollIntervalMs("4000")).toBe(15_000);
    expect(clampPollIntervalMs("2000")).toBe(15_000);
  });

  it("returns the floor as the default when no value is given", () => {
    expect(clampPollIntervalMs(null)).toBe(15_000);
  });

  it("returns the floor for a non-numeric value", () => {
    expect(clampPollIntervalMs("not-a-number")).toBe(15_000);
  });

  it("clamps a request above the ceiling down to the ceiling", () => {
    expect(clampPollIntervalMs("999999")).toBe(30_000);
  });

  it("passes through a value already within the allowed range", () => {
    expect(clampPollIntervalMs("20000")).toBe(20_000);
  });
});

describe("GET /api/chat/conversations (JSON mode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-abc" } } as never);
  });

  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns the conversation list as JSON when stream is not requested", async () => {
    const conversations = [{ userId: "peer-1", name: "Peer", lastMessage: "hi" }];
    vi.mocked(getChatConversationsForUser).mockResolvedValue(conversations as never);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, conversations });
    expect(res.headers.get("Content-Type")).not.toMatch(/event-stream/);
  });

  it("returns 500 when the query throws", async () => {
    vi.mocked(getChatConversationsForUser).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it("switches to an SSE stream when stream=1 is present", async () => {
    vi.mocked(getChatConversationsForUser).mockResolvedValue([] as never);
    const res = await GET(makeRequest("?stream=1"));
    expect(res.headers.get("Content-Type")).toMatch(/event-stream/);
  });
});
