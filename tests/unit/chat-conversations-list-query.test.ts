import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

// Mock the db so no real connection is opened; we only capture the SQL
// that getChatConversationsForUser hands to db.execute.
vi.mock("@/drizzle/db", () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(),
  },
}));

// env import inside drizzle/db chain is bypassed by the mock above, but
// session-presence also touches db — same mock covers it transitively.

import { db } from "@/drizzle/db";
import {
  getChatActivitySignature,
  getChatConversationsForUser,
} from "@/features/chat/db/conversations-list";

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

describe("getChatConversationsForUser latest-message query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Empty result set → function returns early after the first query,
    // so we never reach the profile/unread/presence queries.
    vi.mocked(db.execute).mockResolvedValue([] as never);
  });

  // Validates the PostgreSQL 42P10 invariant: the DISTINCT ON expression must be
  // structurally identical to the leading ORDER BY expression. Drizzle's sql
  // template turns every ${param} interpolation into a NEW placeholder ($1, $5, ...),
  // so an expression repeated in DISTINCT ON and ORDER BY silently diverges
  // ("... = $1" vs "... = $5") and Postgres rejects the query at parse time.
  it("uses an identical expression for DISTINCT ON and the first ORDER BY key", async () => {
    await getChatConversationsForUser("user-abc");

    expect(db.execute).toHaveBeenCalledTimes(1);
    const sqlArg = vi.mocked(db.execute).mock.calls[0][0];
    const { sql: text } = dialect.sqlToQuery(sqlArg as never);

    const distinctExpr = normalize(extractDistinctOnExpr(text));
    const orderExpr = normalize(extractFirstOrderByExpr(text));

    expect(distinctExpr).toBe(orderExpr);
  });

  // Validates that the query still filters by the current user on both sides
  // of the conversation (sender OR recipient).
  it("binds the current user id for both sender and recipient filters", async () => {
    await getChatConversationsForUser("user-abc");

    const sqlArg = vi.mocked(db.execute).mock.calls[0][0];
    const { sql: text, params } = dialect.sqlToQuery(sqlArg as never);

    expect(text).toMatch(/sender_id = \$\d+ OR m\.recipient_id = \$\d+/);
    expect(params.every((p) => p === "user-abc")).toBe(true);
    expect(params.length).toBeGreaterThanOrEqual(2);
  });

  // Validates the early-exit contract: no further queries when there are no messages.
  it("returns [] without further queries when the user has no messages", async () => {
    const result = await getChatConversationsForUser("user-abc");
    expect(result).toEqual([]);
    expect(db.select).not.toHaveBeenCalled();
  });
});

describe("getChatActivitySignature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Validates the SSE change-detection contract: one single aggregate query whose
  // result covers new messages (created_at), edits (edited_at), deletes (total)
  // and read-state changes (unread) — any of those must alter the signature.
  it("issues one aggregate query and returns a stable fingerprint of its row", async () => {
    const row = {
      lastCreated: "2026-07-05T10:00:00.000Z",
      lastEdited: null,
      total: "42",
      unread: "3",
    };
    vi.mocked(db.execute).mockResolvedValue([row] as never);

    const sig1 = await getChatActivitySignature("user-abc");
    const sig2 = await getChatActivitySignature("user-abc");

    expect(db.execute).toHaveBeenCalledTimes(2);
    expect(sig1).toBe(JSON.stringify(row));
    expect(sig1).toBe(sig2);

    const { sql: text, params } = dialect.sqlToQuery(
      vi.mocked(db.execute).mock.calls[0][0] as never
    );
    expect(text).toContain("max(m.created_at)");
    expect(text).toContain("max(m.edited_at)");
    expect(text).toContain("FILTER (WHERE m.recipient_id =");
    expect(params.every((p) => p === "user-abc")).toBe(true);
  });

  // Validates that a changed aggregate row produces a different signature.
  it("changes when any aggregate changes", async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([{ lastCreated: "a", lastEdited: null, total: "1", unread: "0" }] as never)
      .mockResolvedValueOnce([{ lastCreated: "a", lastEdited: null, total: "1", unread: "1" }] as never);

    const sig1 = await getChatActivitySignature("user-abc");
    const sig2 = await getChatActivitySignature("user-abc");
    expect(sig1).not.toBe(sig2);
  });

  // Validates the no-messages edge: empty result still yields a valid signature.
  it("returns a stable empty signature when the user has no rows", async () => {
    vi.mocked(db.execute).mockResolvedValue([] as never);
    await expect(getChatActivitySignature("user-abc")).resolves.toBe("{}");
  });
});
