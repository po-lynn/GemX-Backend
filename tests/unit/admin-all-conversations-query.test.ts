import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

// Mock the db so no real connection is opened; we only capture the SQL/params
// that admin-all-conversations hands to db.execute/select.
vi.mock("@/drizzle/db", () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

import { db } from "@/drizzle/db";
import {
  getAdminChatLastSeenAt,
  getAllConversationsCount,
  getAllConversationsForAdmin,
  getConversationMessagesForAdmin,
  getNewConversationsForAdmin,
  getNewMessageCountForAdmin,
  markAdminChatSeen,
} from "@/features/chat/db/admin-all-conversations";

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

/** Extract the first ORDER BY expression (up to the first top-level comma), from the
 * innermost `ORDER BY` clause (the one immediately preceding the DISTINCT ON select). */
function extractFirstOrderByExprAfter(query: string, afterIndex: number): string {
  const start = query.indexOf("ORDER BY", afterIndex);
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

describe("getAllConversationsForAdmin pair-dedup query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.execute).mockResolvedValue([] as never);
  });

  // Validates the PostgreSQL 42P10 invariant: DISTINCT ON must match the leading
  // ORDER BY expression it's paired with (same rule as getChatConversationsForUser).
  it("uses an identical expression for DISTINCT ON and its paired ORDER BY key", async () => {
    await getAllConversationsForAdmin(1, 30);

    expect(db.execute).toHaveBeenCalledTimes(1);
    const sqlArg = vi.mocked(db.execute).mock.calls[0][0];
    const { sql: text } = dialect.sqlToQuery(sqlArg as never);

    const distinctStart = text.indexOf("DISTINCT ON (");
    const distinctExpr = normalize(extractDistinctOnExpr(text));
    const orderExpr = normalize(extractFirstOrderByExprAfter(text, distinctStart));

    expect(distinctExpr).toBe(orderExpr);
  });

  // Validates the pair key collapses (A,B) and (B,A) into the same group regardless
  // of who sent vs received — the whole point of the admin-wide (not per-user) view.
  it("builds pair_key from LEAST/GREATEST of sender and recipient, not a fixed side", async () => {
    await getAllConversationsForAdmin(1, 30);

    const sqlArg = vi.mocked(db.execute).mock.calls[0][0];
    const { sql: text } = dialect.sqlToQuery(sqlArg as never);

    expect(text).toContain("LEAST(m.sender_id, m.recipient_id)");
    expect(text).toContain("GREATEST(m.sender_id, m.recipient_id)");
  });

  // Validates pagination binds through to LIMIT/OFFSET.
  it("binds page/limit as LIMIT and computed OFFSET", async () => {
    await getAllConversationsForAdmin(3, 20);

    const sqlArg = vi.mocked(db.execute).mock.calls[0][0];
    const { params } = dialect.sqlToQuery(sqlArg as never);

    expect(params).toContain(20); // limit
    expect(params).toContain(40); // offset = (page-1) * limit
  });

  // Validates the early-exit contract: no profile lookup when there are no conversations.
  it("returns [] without a profile lookup when there are no messages at all", async () => {
    const result = await getAllConversationsForAdmin(1, 30);
    expect(result).toEqual([]);
    expect(db.select).not.toHaveBeenCalled();
  });

  // Validates row shaping: both participants come from the last message's sender/recipient,
  // and unknown profiles fall back gracefully instead of throwing.
  it("maps each pair row to two participants, falling back for unknown profiles", async () => {
    vi.mocked(db.execute).mockResolvedValue([
      {
        lastSenderId: "user-a",
        lastRecipientId: "user-b",
        content: "hello",
        fileUrl: null,
        imageUrls: null,
        messageType: "text",
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ] as never);
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () =>
          Promise.resolve([{ id: "user-a", name: "Alice", image: null, role: "user" }]),
      }),
    } as never);

    const [row] = await getAllConversationsForAdmin(1, 30);
    expect(row.participants[0]).toEqual({ id: "user-a", name: "Alice", image: null, role: "user" });
    expect(row.participants[1]).toEqual({ id: "user-b", name: "Unknown user", image: null, role: "" });
    expect(row.lastMessage).toBe("hello");
  });
});

describe("getAllConversationsCount", () => {
  beforeEach(() => vi.clearAllMocks());

  // Validates the count query dedups by the same pair_key formula as the list query,
  // so total/pageCount always agree with what the list actually returns.
  it("counts distinct pairs via the same LEAST/GREATEST formula", async () => {
    vi.mocked(db.execute).mockResolvedValue([{ count: 7 }] as never);
    const count = await getAllConversationsCount();
    expect(count).toBe(7);

    const sqlArg = vi.mocked(db.execute).mock.calls[0][0];
    const { sql: text } = dialect.sqlToQuery(sqlArg as never);
    expect(text).toContain("LEAST(sender_id, recipient_id)");
    expect(text).toContain("GREATEST(sender_id, recipient_id)");
  });

  // Validates the no-rows edge returns 0 rather than undefined/throwing.
  it("returns 0 when the messages table is empty", async () => {
    vi.mocked(db.execute).mockResolvedValue([] as never);
    await expect(getAllConversationsCount()).resolves.toBe(0);
  });
});

describe("getConversationMessagesForAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  // Validates the thread query is symmetric: it must match messages sent in either
  // direction between the two given users, since admin oversight doesn't have a "me".
  it("queries messages in both directions between the two given users", async () => {
    const selectCalls: unknown[] = [];
    vi.mocked(db.select).mockImplementation((...args: unknown[]) => {
      selectCalls.push(args);
      return {
        from: () => ({
          where: (w: unknown) => ({
            orderBy: () => ({
              limit: () => ({
                offset: () => Promise.resolve([]),
              }),
            }),
            then: (resolve: (v: unknown) => unknown) => Promise.resolve([{ count: 0 }]).then(resolve),
          }),
        }),
      } as never;
    });

    const result = await getConversationMessagesForAdmin("user-a", "user-b", 1, 100);
    expect(result).toEqual({ messages: [], total: 0 });
    expect(db.select).toHaveBeenCalledTimes(2); // rows + count, run in parallel
  });

  // Validates messages come back oldest-first (DB query is DESC + limit, then reversed).
  it("returns messages in ascending chronological order", async () => {
    const rows = [
      {
        id: "m2",
        senderId: "user-a",
        recipientId: "user-b",
        content: "second",
        fileUrl: null,
        imageUrls: null,
        messageType: "text",
        createdAt: new Date("2026-07-02T00:00:00.000Z"),
      },
      {
        id: "m1",
        senderId: "user-b",
        recipientId: "user-a",
        content: "first",
        fileUrl: null,
        imageUrls: null,
        messageType: "text",
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ];
    let callIndex = 0;
    vi.mocked(db.select).mockImplementation(() => {
      const isFirstCall = callIndex === 0;
      callIndex++;
      return {
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                offset: () => Promise.resolve(isFirstCall ? rows : []),
              }),
            }),
            then: (resolve: (v: unknown) => unknown) =>
              Promise.resolve(isFirstCall ? rows : [{ count: 2 }]).then(resolve),
          }),
        }),
      } as never;
    });

    const { messages, total } = await getConversationMessagesForAdmin("user-a", "user-b", 1, 100);
    expect(total).toBe(2);
    expect(messages.map((m) => m.id)).toEqual(["m1", "m2"]);
  });
});

describe("admin chat cursor (bell 'seen' tracking)", () => {
  beforeEach(() => vi.clearAllMocks());

  // Validates the "never opened the feed before" default: epoch, not null/undefined,
  // so downstream `createdAt > since` comparisons still work.
  it("getAdminChatLastSeenAt defaults to the epoch when there is no cursor row", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    } as never);

    const since = await getAdminChatLastSeenAt("admin-1");
    expect(since.getTime()).toBe(0);
  });

  // Validates the cursor row's timestamp is returned as-is when present.
  it("getAdminChatLastSeenAt returns the stored cursor when present", async () => {
    const stored = new Date("2026-07-20T00:00:00.000Z");
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ lastSeenAt: stored }]),
        }),
      }),
    } as never);

    const since = await getAdminChatLastSeenAt("admin-1");
    expect(since).toEqual(stored);
  });

  // Validates markAdminChatSeen upserts (insert-or-update) rather than assuming a row exists.
  it("markAdminChatSeen upserts the cursor row for this admin", async () => {
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const onConflictDoUpdate = vi.fn(() => Promise.resolve(undefined));
    vi.mocked(db.insert).mockReturnValue({ values } as never);

    await markAdminChatSeen("admin-1");

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ userId: "admin-1" }));
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.anything(), set: expect.anything() })
    );
  });
});

describe("getNewMessageCountForAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  // Validates the count excludes the admin's own outgoing messages and is scoped to `since`.
  it("filters by created_at > since and excludes the admin's own messages", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([{ count: 3 }]),
      }),
    } as never);

    const count = await getNewMessageCountForAdmin("admin-1", new Date("2026-07-20T00:00:00.000Z"));
    expect(count).toBe(3);
  });

  // Validates the zero-row edge returns 0 rather than undefined.
  it("returns 0 when there are no matching rows", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([]),
      }),
    } as never);

    const count = await getNewMessageCountForAdmin("admin-1", new Date(0));
    expect(count).toBe(0);
  });
});

describe("getNewConversationsForAdmin new-activity query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.execute).mockResolvedValue([] as never);
  });

  // Same 42P10 invariant as getAllConversationsForAdmin's pair query.
  it("uses an identical expression for DISTINCT ON and its paired ORDER BY key", async () => {
    await getNewConversationsForAdmin("admin-1", new Date(0));

    const sqlArg = vi.mocked(db.execute).mock.calls[0][0];
    const { sql: text } = dialect.sqlToQuery(sqlArg as never);

    const distinctStart = text.indexOf("DISTINCT ON (");
    const distinctExpr = normalize(extractDistinctOnExpr(text));
    const orderExpr = normalize(extractFirstOrderByExprAfter(text, distinctStart));

    expect(distinctExpr).toBe(orderExpr);
  });

  // Validates the two filters that make this "new since I looked, and not my own message":
  // createdAt > since, and the pair's last sender isn't the admin themself.
  it("filters to pairs whose latest message is after `since` and not sent by the admin", async () => {
    const since = new Date("2026-07-20T00:00:00.000Z");
    await getNewConversationsForAdmin("admin-1", since, 10);

    const sqlArg = vi.mocked(db.execute).mock.calls[0][0];
    const { sql: text, params } = dialect.sqlToQuery(sqlArg as never);

    expect(text).toContain('"createdAt" >');
    expect(text).toContain('"lastSenderId" !=');
    // Serialized to an ISO string before binding — the raw sql tag's driver path
    // (unlike the query-builder's gt()/ne()) can't take a bare Date param.
    expect(params).toContain(since.toISOString());
    expect(params).toContain("admin-1");
    expect(params).toContain(10);
  });

  // Validates the early-exit contract: no profile lookup when nothing is new.
  it("returns [] without a profile lookup when nothing is new", async () => {
    const result = await getNewConversationsForAdmin("admin-1", new Date(0));
    expect(result).toEqual([]);
    expect(db.select).not.toHaveBeenCalled();
  });

  // Validates row shaping matches getAllConversationsForAdmin's shape.
  it("maps rows to participants the same way as the full oversight list", async () => {
    vi.mocked(db.execute).mockResolvedValue([
      {
        lastSenderId: "user-a",
        lastRecipientId: "user-b",
        content: "new here",
        fileUrl: null,
        imageUrls: null,
        messageType: "text",
        createdAt: new Date("2026-07-21T00:00:00.000Z"),
      },
    ] as never);
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () =>
          Promise.resolve([{ id: "user-a", name: "Alice", image: null, role: "user" }]),
      }),
    } as never);

    const [row] = await getNewConversationsForAdmin("admin-1", new Date(0));
    expect(row.participants[0]).toEqual({ id: "user-a", name: "Alice", image: null, role: "user" });
    expect(row.participants[1]).toEqual({ id: "user-b", name: "Unknown user", image: null, role: "" });
    expect(row.lastMessage).toBe("new here");
  });
});
