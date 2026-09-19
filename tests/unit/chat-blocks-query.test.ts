import { beforeEach, describe, expect, it, vi } from "vitest";

// Unit tests for features/chat/db/blocks.ts's actual query logic — in particular
// isBlockedEitherDirection's bidirectional check and getBlockedPeerIds's candidate
// filtering, which the API-route-level tests (tests/api/chat/blocks.test.ts) mock
// straight through rather than exercise.

vi.mock("@/drizzle/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), delete: vi.fn() },
}));

const { db } = await import("@/drizzle/db");
const {
  blockUser,
  unblockUser,
  isBlockedEitherDirection,
  getBlockedPeerIds,
  listBlockedUsers,
} = await import("@/features/chat/db/blocks");

function selectChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function insertChain() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn(() => chain);
  chain.onConflictDoNothing = vi.fn(() => Promise.resolve(undefined));
  return chain;
}

function deleteChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.where = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(result));
  return chain;
}

describe("blockUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts with onConflictDoNothing so a repeat block is a no-op, not an error", async () => {
    const chain = insertChain();
    vi.mocked(db.insert).mockReturnValue(chain as never);

    await blockUser("blocker-1", "blocked-1", "harassment");

    expect(chain.values).toHaveBeenCalledWith({
      blockerId: "blocker-1",
      blockedId: "blocked-1",
      reason: "harassment",
    });
    expect(chain.onConflictDoNothing).toHaveBeenCalled();
  });

  it("defaults reason to null when omitted", async () => {
    const chain = insertChain();
    vi.mocked(db.insert).mockReturnValue(chain as never);

    await blockUser("blocker-1", "blocked-1");

    expect(chain.values).toHaveBeenCalledWith({
      blockerId: "blocker-1",
      blockedId: "blocked-1",
      reason: null,
    });
  });
});

describe("unblockUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when a row was deleted", async () => {
    vi.mocked(db.delete).mockReturnValue(deleteChain([{ blockerId: "blocker-1" }]) as never);
    await expect(unblockUser("blocker-1", "blocked-1")).resolves.toBe(true);
  });

  it("returns false when there was nothing to delete", async () => {
    vi.mocked(db.delete).mockReturnValue(deleteChain([]) as never);
    await expect(unblockUser("blocker-1", "blocked-1")).resolves.toBe(false);
  });
});

describe("isBlockedEitherDirection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when a row exists", async () => {
    vi.mocked(db.select).mockReturnValue(selectChain([{ blockerId: "a" }]) as never);
    await expect(isBlockedEitherDirection("a", "b")).resolves.toBe(true);
  });

  it("returns false when no row exists", async () => {
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never);
    await expect(isBlockedEitherDirection("a", "b")).resolves.toBe(false);
  });
});

describe("getBlockedPeerIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty set without querying when there are no candidates", async () => {
    await expect(getBlockedPeerIds("user-1", [])).resolves.toEqual(new Set());
    expect(db.select).not.toHaveBeenCalled();
  });

  // The row's direction determines which side is "the peer": when the current user is
  // the blocker, the peer is blockedId; when the current user was blocked, the peer is
  // blockerId.
  it("resolves the peer id from whichever side isn't the current user, for each direction", async () => {
    vi.mocked(db.select).mockReturnValue(
      selectChain([
        { blockerId: "user-1", blockedId: "peer-a" }, // user-1 blocked peer-a
        { blockerId: "peer-b", blockedId: "user-1" }, // peer-b blocked user-1
      ]) as never
    );

    const result = await getBlockedPeerIds("user-1", ["peer-a", "peer-b", "peer-c"]);

    expect(result).toEqual(new Set(["peer-a", "peer-b"]));
  });

  it("excludes rows whose peer isn't in the candidate list", async () => {
    vi.mocked(db.select).mockReturnValue(
      selectChain([{ blockerId: "user-1", blockedId: "peer-not-a-candidate" }]) as never
    );

    const result = await getBlockedPeerIds("user-1", ["peer-a"]);

    expect(result).toEqual(new Set());
  });
});

describe("listBlockedUsers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps rows and serializes createdAt to an ISO string", async () => {
    const createdAt = new Date("2026-08-01T00:00:00.000Z");
    vi.mocked(db.select).mockReturnValue(
      selectChain([
        { userId: "peer-a", name: "Peer A", image: null, reason: "spam", createdAt },
      ]) as never
    );

    const result = await listBlockedUsers("blocker-1");

    expect(result).toEqual([
      { userId: "peer-a", name: "Peer A", image: null, reason: "spam", createdAt: createdAt.toISOString() },
    ]);
  });
});
