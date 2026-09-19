import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/drizzle/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/features/chat/db/blocks", () => ({
  blockUser: vi.fn().mockResolvedValue(undefined),
  unblockUser: vi.fn(),
  listBlockedUsers: vi.fn(),
}));

const { auth } = await import("@/lib/auth");
const { db } = await import("@/drizzle/db");
const { blockUser, unblockUser, listBlockedUsers } = await import("@/features/chat/db/blocks");
const { GET, POST } = await import("@/app/api/chat/blocks/route");
const { DELETE } = await import("@/app/api/chat/blocks/[userId]/route");

function selectChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(result));
  return chain;
}

function makePostRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/chat/blocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function makeGetRequest(): NextRequest {
  return new Request("http://localhost/api/chat/blocks") as unknown as NextRequest;
}

function makeDeleteRequest(): NextRequest {
  return new Request("http://localhost/api/chat/blocks/peer-1", { method: "DELETE" }) as unknown as NextRequest;
}

function makeContext(userId = "peer-1") {
  return { params: Promise.resolve({ userId }) };
}

describe("GET /api/chat/blocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "me-1" } } as never);
  });

  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns the caller's blocked-user list", async () => {
    vi.mocked(listBlockedUsers).mockResolvedValue([
      { userId: "peer-1", name: "Peer", image: null, reason: null, createdAt: "2026-08-01T00:00:00.000Z" },
    ]);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(listBlockedUsers).toHaveBeenCalledWith("me-1");
    expect(json.blocked).toHaveLength(1);
  });
});

describe("POST /api/chat/blocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "me-1" } } as never);
  });

  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await POST(makePostRequest({ userId: "peer-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 without a userId", async () => {
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(400);
    expect(blockUser).not.toHaveBeenCalled();
  });

  it("returns 400 when blocking yourself", async () => {
    const res = await POST(makePostRequest({ userId: "me-1" }));
    expect(res.status).toBe(400);
    expect(blockUser).not.toHaveBeenCalled();
  });

  it("returns 404 when the target user doesn't exist", async () => {
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never);
    const res = await POST(makePostRequest({ userId: "ghost" }));
    expect(res.status).toBe(404);
    expect(blockUser).not.toHaveBeenCalled();
  });

  it("blocks the target user", async () => {
    vi.mocked(db.select).mockReturnValue(selectChain([{ id: "peer-1" }]) as never);

    const res = await POST(makePostRequest({ userId: "peer-1", reason: "spam" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(blockUser).toHaveBeenCalledWith("me-1", "peer-1", "spam");
  });
});

describe("DELETE /api/chat/blocks/[userId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "me-1" } } as never);
  });

  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(401);
  });

  it("returns 404 when there was no block to lift", async () => {
    vi.mocked(unblockUser).mockResolvedValue(false);
    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(404);
  });

  it("unblocks the target user", async () => {
    vi.mocked(unblockUser).mockResolvedValue(true);
    const res = await DELETE(makeDeleteRequest(), makeContext());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(unblockUser).toHaveBeenCalledWith("me-1", "peer-1");
  });
});
