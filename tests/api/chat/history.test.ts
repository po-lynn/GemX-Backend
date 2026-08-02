import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/drizzle/db", () => ({ db: { select: vi.fn() } }));

const { auth } = await import("@/lib/auth");
const { db } = await import("@/drizzle/db");
const { GET } = await import("@/app/api/chat/history/route");

/** Thenable select-chain mock: supports every chain method this route uses and
 *  resolves to `result` wherever it's awaited. */
function selectChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

/** Thenable that never settles — simulates a hung DB call for the timeout guard. */
function pendingChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.then = () => {
    /* never calls resolve or reject */
  };
  return chain;
}

function makeRequest(query = "userId=peer-1"): NextRequest {
  return new Request(`http://localhost/api/chat/history?${query}`) as unknown as NextRequest;
}

const messageRow = {
  id: "msg-1",
  senderId: "sender-1",
  recipientId: "peer-1",
  content: "hi",
  fileUrl: null,
  imageUrls: null,
  messageType: "text",
  isRead: true,
  starred: false,
  editedAt: null,
  createdAt: new Date("2026-07-05T00:00:00.000Z"),
};

describe("GET /api/chat/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "sender-1" },
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(db.select).not.toHaveBeenCalled();
  });

  // Validates the happy path: messages are reversed to chronological order, total comes from
  // the count query, and the peer's image decorates participantImage.
  it("returns messages, total, and participantImage on success", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([messageRow]) as never) // messages page
      .mockReturnValueOnce(selectChain([{ count: 1 }]) as never) // total count
      .mockReturnValueOnce(selectChain([{ image: "https://example.com/avatar.png" }]) as never); // peer image

    const res = await GET(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.messages).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.participantImage).toBe("https://example.com/avatar.png");
  });

  // Validates the secondary/degrade-gracefully path: the peer avatar lookup timing out must
  // not fail the whole response — it degrades to a null avatar while messages/total still load.
  it("degrades to a null participantImage when the peer image lookup hangs, without failing the request", async () => {
    vi.useFakeTimers();
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([messageRow]) as never) // messages page
      .mockReturnValueOnce(selectChain([{ count: 1 }]) as never) // total count
      .mockReturnValueOnce(pendingChain() as never); // peer image hangs

    const resPromise = GET(makeRequest());
    await vi.advanceTimersByTimeAsync(3000);
    const res = await resPromise;
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.messages).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.participantImage).toBeNull();
  });

  // Validates the primary-query timeout guard on the messages page itself: it must fail loud
  // with a retryable 503 rather than returning an empty/partial chat history.
  it("returns 503 with Retry-After when the messages query hangs past the timeout", async () => {
    vi.useFakeTimers();
    vi.mocked(db.select).mockReturnValueOnce(pendingChain() as never); // messages page hangs

    const resPromise = GET(makeRequest());
    await vi.advanceTimersByTimeAsync(6000);
    const res = await resPromise;

    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("3");
    const data = await res.json();
    expect(data.error).toMatch(/retry/i);
  });

  // Validates the primary-query timeout guard on the total count: pagination needs an
  // accurate total, so a hung count query must also fail loud rather than silently show 0.
  it("returns 503 with Retry-After when the count query hangs past the timeout", async () => {
    vi.useFakeTimers();
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([messageRow]) as never) // messages page resolves
      .mockReturnValueOnce(pendingChain() as never); // count hangs

    const resPromise = GET(makeRequest());
    await vi.advanceTimersByTimeAsync(6000);
    const res = await resPromise;

    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("3");
  });

  // Validates the existing null-avatar fallback still holds when there's simply no peer row.
  it("returns a null participantImage when the peer row doesn't exist", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([messageRow]) as never)
      .mockReturnValueOnce(selectChain([{ count: 1 }]) as never)
      .mockReturnValueOnce(selectChain([]) as never);

    const res = await GET(makeRequest());
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.participantImage).toBeNull();
  });
});
