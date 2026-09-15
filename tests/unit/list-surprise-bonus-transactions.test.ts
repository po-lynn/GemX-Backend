import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/drizzle/db", () => ({
  db: { select: vi.fn() },
}))

import { db } from "@/drizzle/db"
import { listSurpriseBonusTransactions } from "@/features/points/db/surprise-bonus"

/** Every builder method returns the chain itself so calls can be chained in
 * any order the source uses, and the chain is itself thenable so `await`
 * resolves `rows` whether or not `.limit()` is the last call made. */
function mockSelectChain(rows: unknown[]) {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(rows),
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  }
  return chain
}

const select = vi.mocked(db.select)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("listSurpriseBonusTransactions", () => {
  // Confirms the two data sources (completed point_transaction rows and
  // still-in-flight background_jobs batches) are merged into one list,
  // newest first, with job rows enriched with their campaign name.
  it("merges completed transactions and in-flight batches, sorted newest first", async () => {
    select
      .mockReturnValueOnce(
        mockSelectChain([
          {
            id: "tx-1",
            amount: 500,
            referenceId: "campaign-1",
            createdAt: new Date("2026-09-14T09:00:00Z"),
            userName: "Jane Doe",
            userEmail: "jane@example.com",
          },
        ]) as never,
      )
      .mockReturnValueOnce(
        mockSelectChain([
          {
            id: "job-1",
            type: "surprise_bonus_batch",
            payload: { campaignId: "campaign-1", lastUserId: "user-99" },
            status: "pending",
            attempts: 0,
            maxAttempts: 5,
            lockedAt: null,
            lastError: null,
            createdAt: new Date("2026-09-14T21:02:00Z"),
            completedAt: null,
          },
        ]) as never,
      )
      .mockReturnValueOnce(mockSelectChain([{ id: "campaign-1", name: "NYC200" }]) as never)

    const result = await listSurpriseBonusTransactions(200)

    expect(result).toEqual([
      {
        id: "job-1",
        source: "job",
        description: "Credit batch — NYC200",
        state: "pending",
        createdAt: new Date("2026-09-14T21:02:00Z"),
        completedAt: null,
        reference: "campaign-1",
        detail: "0/5 attempts",
      },
      {
        id: "tx-1",
        source: "transaction",
        description: "Jane Doe (jane@example.com)",
        state: "completed",
        createdAt: new Date("2026-09-14T09:00:00Z"),
        completedAt: new Date("2026-09-14T09:00:00Z"),
        reference: "campaign-1",
        detail: "+500 pts",
      },
    ])
  })

  // A batch stuck in "processing" past the stale window (STALE_AFTER_MS,
  // shared with the Jobs view's own stale detection) should say so in detail
  // even though its `state` stays "processing" (the union has no separate
  // stale state) — this is what makes a stranded batch discoverable.
  it("flags a processing batch as stale in its detail text once past the stale window", async () => {
    select
      .mockReturnValueOnce(mockSelectChain([]) as never)
      .mockReturnValueOnce(
        mockSelectChain([
          {
            id: "job-2",
            type: "surprise_bonus_push_batch",
            payload: { campaignId: "campaign-1", userIds: ["u1", "u2"] },
            status: "processing",
            attempts: 1,
            maxAttempts: 5,
            lockedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago > 3 min stale window
            lastError: null,
            createdAt: new Date("2026-09-14T20:00:00Z"),
            completedAt: null,
          },
        ]) as never,
      )
      .mockReturnValueOnce(mockSelectChain([{ id: "campaign-1", name: "NYC200" }]) as never)

    const [row] = await listSurpriseBonusTransactions(200)

    expect(row).toMatchObject({
      id: "job-2",
      description: "Push batch — NYC200 (2 users)",
      state: "processing",
      detail: "Stale — locked but not progressing",
    })
  })

  // A batch's own lastError takes priority over the attempts/stale summary —
  // it's the most actionable thing an admin can see for a failed batch.
  it("prefers lastError over the attempts summary when a batch has failed", async () => {
    select
      .mockReturnValueOnce(mockSelectChain([]) as never)
      .mockReturnValueOnce(
        mockSelectChain([
          {
            id: "job-3",
            type: "surprise_bonus_batch",
            payload: {},
            status: "failed",
            attempts: 5,
            maxAttempts: 5,
            lockedAt: null,
            lastError: "grant_surprise_bonus_user: relation missing",
            createdAt: new Date("2026-09-14T20:00:00Z"),
            completedAt: new Date("2026-09-14T20:05:00Z"),
          },
        ]) as never,
      )

    const [row] = await listSurpriseBonusTransactions(200)

    expect(row).toMatchObject({
      id: "job-3",
      description: "Credit batch job-3",
      state: "failed",
      detail: "grant_surprise_bonus_user: relation missing",
    })
  })

  // No in-flight batches means no campaignId to look up — the campaign-name
  // enrichment query must not run at all.
  it("skips the campaign-name lookup entirely when there are no in-flight batches", async () => {
    select.mockReturnValueOnce(mockSelectChain([]) as never).mockReturnValueOnce(mockSelectChain([]) as never)

    const result = await listSurpriseBonusTransactions(200)

    expect(result).toEqual([])
    expect(select).toHaveBeenCalledTimes(2)
  })

  it("caps the merged, sorted result at the requested limit", async () => {
    const older = new Date("2026-09-01T00:00:00Z")
    const newer = new Date("2026-09-14T00:00:00Z")
    select
      .mockReturnValueOnce(
        mockSelectChain([
          { id: "tx-old", amount: 10, referenceId: "c1", createdAt: older, userName: "A", userEmail: "a@x.com" },
          { id: "tx-new", amount: 10, referenceId: "c1", createdAt: newer, userName: "B", userEmail: "b@x.com" },
        ]) as never,
      )
      .mockReturnValueOnce(mockSelectChain([]) as never)

    const result = await listSurpriseBonusTransactions(1)

    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe("tx-new")
  })
})
