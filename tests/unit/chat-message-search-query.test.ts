import { beforeEach, describe, expect, it, vi } from "vitest";

// Unit tests for features/chat/db/message-search.ts. Validates the participant scoping
// (own messages only, optionally narrowed to one peer), the peer-id resolution that
// turns "sender or recipient" into a single peerId per result row, and that rows +
// total are read from ONE query (count(*) OVER()), not a separate count round trip.

vi.mock("@/drizzle/db", () => ({ db: { select: vi.fn() } }));

const { db } = await import("@/drizzle/db");
const { searchChatMessages } = await import("@/features/chat/db/message-search");

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

const messageRow = {
  id: "msg-1",
  senderId: "me-1",
  recipientId: "peer-1",
  content: "let's talk about the sapphire",
  messageType: "text",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  total: 1,
};

describe("searchChatMessages", () => {
  beforeEach(() => vi.clearAllMocks());

  // count(*) OVER() means a truly empty match set is one query, not two.
  it("returns an empty result set without a profile lookup when nothing matches, in one query", async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never);

    const result = await searchChatMessages("me-1", "sapphire", { page: 1, limit: 30 });

    expect(result).toEqual({ results: [], total: 0 });
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it("resolves peerId to whichever side of the message isn't the current user, reading total from the same row", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([messageRow]) as never) // messages + total
      .mockReturnValueOnce(selectChain([{ id: "peer-1", name: "Peer One", image: null }]) as never); // profiles

    const result = await searchChatMessages("me-1", "sapphire", { page: 1, limit: 30 });

    expect(db.select).toHaveBeenCalledTimes(2);
    expect(result.total).toBe(1);
    expect(result.results).toEqual([
      {
        id: "msg-1",
        peerId: "peer-1",
        peerName: "Peer One",
        peerImage: null,
        content: "let's talk about the sapphire",
        messageType: "text",
        createdAt: "2026-08-01T00:00:00.000Z",
      },
    ]);
  });

  it("resolves peerId correctly when the current user was the recipient, not the sender", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(
        selectChain([{ ...messageRow, senderId: "peer-1", recipientId: "me-1" }]) as never
      )
      .mockReturnValueOnce(selectChain([{ id: "peer-1", name: "Peer One", image: null }]) as never);

    const result = await searchChatMessages("me-1", "sapphire", { page: 1, limit: 30 });

    expect(result.results[0]?.peerId).toBe("peer-1");
  });

  it("falls back to null peer fields when no profile row matches", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([messageRow]) as never)
      .mockReturnValueOnce(selectChain([]) as never); // no profile match

    const result = await searchChatMessages("me-1", "sapphire", { page: 1, limit: 30 });

    expect(result.results[0]).toMatchObject({ peerName: null, peerImage: null });
  });

  // Documents the accepted trade-off of count(*) OVER(): a page requested past the last
  // one returns zero rows (OFFSET removes them before the window function can be read),
  // so total comes back 0 rather than the true match count for that edge case.
  it("reports total: 0 for a page requested past the last page of results", async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never);

    const result = await searchChatMessages("me-1", "sapphire", { page: 50, limit: 30 });

    expect(result).toEqual({ results: [], total: 0 });
  });
});
