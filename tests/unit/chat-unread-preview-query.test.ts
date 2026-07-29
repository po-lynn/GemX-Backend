import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

// Mock the db so no real connection is opened; we capture the SQL handed to
// db.execute and stub db.select for the profile/unread-count joins.
vi.mock("@/drizzle/db", () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(),
  },
}));

import { db } from "@/drizzle/db";
import { getUnreadConversationPreviews } from "@/features/chat/db/conversations-list";

const dialect = new PgDialect();

/** Extract the balanced-paren contents of `DISTINCT ON ( ... )`. */
function extractDistinctOnExpr(query: string): string {
  const start = query.indexOf("DISTINCT ON (");
  expect(start).toBeGreaterThanOrEqual(0);
  let i = start + "DISTINCT ON (".length;
  let depth = 1;
  let out = "";
  while (i < query.length && depth > 0) {
    const ch = query[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth > 0) out += ch;
    i++;
  }
  return out;
}

/** Extract the first ORDER BY expression (up to the first top-level comma). */
function extractFirstOrderByExpr(query: string): string {
  const start = query.indexOf("ORDER BY");
  expect(start).toBeGreaterThanOrEqual(0);
  let i = start + "ORDER BY".length;
  let depth = 0;
  let out = "";
  while (i < query.length) {
    const ch = query[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) break;
    out += ch;
    i++;
  }
  return out;
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

/** Thenable select-chain mock: resolves to `result` wherever the chain is awaited. */
function selectChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

describe("getUnreadConversationPreviews latest-unread-message query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Validates the PostgreSQL 42P10 invariant, same as getChatConversationsForUser:
  // the DISTINCT ON expression must be structurally identical to the leading ORDER BY key.
  it("uses an identical expression for DISTINCT ON and the first ORDER BY key", async () => {
    vi.mocked(db.execute).mockResolvedValue([] as never);

    await getUnreadConversationPreviews("user-abc");

    expect(db.execute).toHaveBeenCalledTimes(1);
    const sqlArg = vi.mocked(db.execute).mock.calls[0][0];
    const { sql: text } = dialect.sqlToQuery(sqlArg as never);

    const distinctExpr = normalize(extractDistinctOnExpr(text));
    const orderExpr = normalize(extractFirstOrderByExpr(text));

    expect(distinctExpr).toBe(orderExpr);
  });

  // Validates the query is scoped to unread messages addressed to the current user.
  it("filters by recipient_id and is_read = false, binding the current user id", async () => {
    vi.mocked(db.execute).mockResolvedValue([] as never);

    await getUnreadConversationPreviews("user-abc");

    const sqlArg = vi.mocked(db.execute).mock.calls[0][0];
    const { sql: text, params } = dialect.sqlToQuery(sqlArg as never);

    expect(text).toMatch(/recipient_id = \$\d+/);
    expect(text).toMatch(/is_read = false/);
    expect(params).toContain("user-abc");
  });

  // Validates the early-exit contract: no profile/unread-count queries when there's nothing unread.
  it("returns [] without further queries when there are no unread messages", async () => {
    vi.mocked(db.execute).mockResolvedValue([] as never);

    const result = await getUnreadConversationPreviews("user-abc");
    expect(result).toEqual([]);
    expect(db.select).not.toHaveBeenCalled();
  });

  // Validates the merge of latest-message rows with profile lookups and per-peer unread counts,
  // plus the `limit` truncation of the final (most-recent-first) list.
  it("merges profile and unread-count data, sorts by recency, and applies the limit", async () => {
    vi.mocked(db.execute).mockResolvedValue([
      {
        peerId: "peer-older",
        content: "hi there",
        fileUrl: null,
        imageUrls: null,
        messageType: "text",
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
      {
        peerId: "peer-newer",
        content: "",
        fileUrl: null,
        imageUrls: ["https://example.com/a.png"],
        messageType: "image",
        createdAt: new Date("2026-07-05T00:00:00.000Z"),
      },
    ] as never);

    vi.mocked(db.select)
      .mockReturnValueOnce(
        selectChain([
          { id: "peer-older", name: "Alice", image: null },
          { id: "peer-newer", name: "Bob", image: "https://example.com/bob.png" },
        ]) as never
      )
      .mockReturnValueOnce(
        selectChain([
          { senderId: "peer-older", unread: 2 },
          { senderId: "peer-newer", unread: 1 },
        ]) as never
      );

    const result = await getUnreadConversationPreviews("user-abc", 1);

    // Most recent first, then truncated to `limit`.
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userId: "peer-newer",
      name: "Bob",
      profileImage: "https://example.com/bob.png",
      lastMessage: "Sent photos",
      unreadCount: 1,
    });
  });

  // Validates the fallback label for a peer whose profile row wasn't found.
  it("falls back to 'Unknown user' when no profile row matches the peer id", async () => {
    vi.mocked(db.execute).mockResolvedValue([
      {
        peerId: "ghost-peer",
        content: "hello?",
        fileUrl: null,
        imageUrls: null,
        messageType: "text",
        createdAt: new Date("2026-07-05T00:00:00.000Z"),
      },
    ] as never);

    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([]) as never)
      .mockReturnValueOnce(selectChain([{ senderId: "ghost-peer", unread: 1 }]) as never);

    const result = await getUnreadConversationPreviews("user-abc");
    expect(result[0]).toMatchObject({ userId: "ghost-peer", name: "Unknown user" });
  });
});
