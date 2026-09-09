import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/drizzle/db", () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/features/points/services/surprise-bonus-push", () => ({
  sendSurpriseBonusPushToUsers: vi.fn().mockResolvedValue({
    sent: 2,
    failed: 0,
    invalidTokensRemoved: 0,
  }),
}))

import { db } from "@/drizzle/db"
import { sendSurpriseBonusPushToUsers } from "@/features/points/services/surprise-bonus-push"
import {
  drainSurpriseBonusJobs,
  processOneSurpriseBonusBatch,
} from "@/features/points/services/process-surprise-bonus-jobs"

function mockSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockResolvedValue(rows)
  return chain
}

function mockUpdateChain() {
  const chain: Record<string, unknown> = {}
  chain.set = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockResolvedValue(undefined)
  return chain
}

describe("processOneSurpriseBonusBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sendSurpriseBonusPushToUsers).mockResolvedValue({
      sent: 2,
      failed: 0,
      invalidTokensRemoved: 0,
    })
  })

  it("returns claimed:false when queue is empty", async () => {
    vi.mocked(db.execute).mockResolvedValue([] as never)
    const result = await processOneSurpriseBonusBatch("local-test")
    expect(result).toEqual({ claimed: false })
  })

  it("grants a batch, sends FCM for newly granted users, completes campaign", async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([
        {
          id: "job-1",
          type: "surprise_bonus_batch",
          payload: { campaignId: "camp-1", lastUserId: null },
          status: "processing",
          attempts: 1,
          max_attempts: 5,
        },
      ] as never)
      .mockResolvedValueOnce([{ result: { granted: true, points: 500 } }] as never)
      .mockResolvedValueOnce([{ result: { granted: true, points: 500 } }] as never)

    const userSelect = mockSelectChain([{ id: "u1" }, { id: "u2" }])
    const campaignSelect = mockSelectChain([
      {
        name: "Sweet December",
        pointsPerUser: 500,
        processedUsers: 0,
        successCount: 0,
        failedCount: 0,
      },
    ])
    vi.mocked(db.select)
      .mockReturnValueOnce(userSelect as never)
      .mockReturnValueOnce(campaignSelect as never)

    const campaignUpdate = mockUpdateChain()
    const jobUpdate = mockUpdateChain()
    vi.mocked(db.update)
      .mockReturnValueOnce(campaignUpdate as never)
      .mockReturnValueOnce(jobUpdate as never)

    const result = await processOneSurpriseBonusBatch("local-test")

    expect(result).toEqual({
      claimed: true,
      jobId: "job-1",
      campaignId: "camp-1",
      batchSize: 2,
      successDelta: 2,
      failedDelta: 0,
      hasMore: false,
      campaignStatus: "completed",
      pushSentTo: 2,
    })
    expect(sendSurpriseBonusPushToUsers).toHaveBeenCalledWith({
      userIds: ["u1", "u2"],
      campaignId: "camp-1",
      campaignName: "Sweet December",
      pointsPerUser: 500,
    })
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("does not push for already_granted users", async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([
        {
          id: "job-1",
          type: "surprise_bonus_batch",
          payload: { campaignId: "camp-1", lastUserId: null },
          status: "processing",
          attempts: 1,
          max_attempts: 5,
        },
      ] as never)
      .mockResolvedValueOnce([
        { result: { granted: false, reason: "already_granted" } },
      ] as never)

    const userSelect = mockSelectChain([{ id: "u1" }])
    const campaignSelect = mockSelectChain([
      {
        name: "Sweet December",
        pointsPerUser: 500,
        processedUsers: 0,
        successCount: 0,
        failedCount: 0,
      },
    ])
    vi.mocked(db.select)
      .mockReturnValueOnce(userSelect as never)
      .mockReturnValueOnce(campaignSelect as never)
    vi.mocked(db.update)
      .mockReturnValueOnce(mockUpdateChain() as never)
      .mockReturnValueOnce(mockUpdateChain() as never)

    await processOneSurpriseBonusBatch("local-test")
    expect(sendSurpriseBonusPushToUsers).not.toHaveBeenCalled()
  })
})

describe("drainSurpriseBonusJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sendSurpriseBonusPushToUsers).mockResolvedValue({
      sent: 1,
      failed: 0,
      invalidTokensRemoved: 0,
    })
  })

  it("stops once the queue has no more claimable jobs", async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([
        {
          id: "job-1",
          type: "surprise_bonus_batch",
          payload: { campaignId: "camp-1", lastUserId: null },
          status: "processing",
          attempts: 1,
          max_attempts: 5,
        },
      ] as never)
      .mockResolvedValueOnce([{ result: { granted: true, points: 10 } }] as never)
      // Second claim attempt: nothing left pending.
      .mockResolvedValueOnce([] as never)

    const userSelect = mockSelectChain([{ id: "u1" }])
    const campaignSelect = mockSelectChain([
      {
        name: "X",
        pointsPerUser: 10,
        processedUsers: 0,
        successCount: 0,
        failedCount: 0,
      },
    ])
    vi.mocked(db.select)
      .mockReturnValueOnce(userSelect as never)
      .mockReturnValueOnce(campaignSelect as never)
    vi.mocked(db.update)
      .mockReturnValueOnce(mockUpdateChain() as never)
      .mockReturnValueOnce(mockUpdateChain() as never)

    const drained = await drainSurpriseBonusJobs({ maxBatches: 10 })
    expect(drained.batches).toBe(1)
    expect(drained.last).toMatchObject({
      claimed: true,
      campaignStatus: "completed",
      hasMore: false,
    })
  })

  it("keeps draining a different campaign's job after the first one's chain finishes", async () => {
    // Regression test: a claimed batch reporting hasMore:false only means that
    // one campaign's chain is done, not that the queue is empty. A backlog of
    // several independent stuck campaigns (e.g. via the admin "Retry stuck
    // jobs" button) must all get processed in one drain, up to maxBatches.
    vi.mocked(db.execute)
      .mockResolvedValueOnce([
        {
          id: "job-1",
          type: "surprise_bonus_batch",
          payload: { campaignId: "camp-1", lastUserId: null },
          status: "pending",
          attempts: 0,
          max_attempts: 5,
        },
      ] as never)
      .mockResolvedValueOnce([{ result: { granted: true, points: 10 } }] as never)
      .mockResolvedValueOnce([
        {
          id: "job-2",
          type: "surprise_bonus_batch",
          payload: { campaignId: "camp-2", lastUserId: null },
          status: "pending",
          attempts: 0,
          max_attempts: 5,
        },
      ] as never)
      .mockResolvedValueOnce([{ result: { granted: true, points: 20 } }] as never)
      // Third claim attempt: queue is finally empty.
      .mockResolvedValueOnce([] as never)

    const userSelect1 = mockSelectChain([{ id: "u1" }])
    const campaignSelect1 = mockSelectChain([
      { name: "Camp 1", pointsPerUser: 10, processedUsers: 0, successCount: 0, failedCount: 0 },
    ])
    const userSelect2 = mockSelectChain([{ id: "u2" }])
    const campaignSelect2 = mockSelectChain([
      { name: "Camp 2", pointsPerUser: 20, processedUsers: 0, successCount: 0, failedCount: 0 },
    ])
    vi.mocked(db.select)
      .mockReturnValueOnce(userSelect1 as never)
      .mockReturnValueOnce(campaignSelect1 as never)
      .mockReturnValueOnce(userSelect2 as never)
      .mockReturnValueOnce(campaignSelect2 as never)
    vi.mocked(db.update)
      .mockReturnValueOnce(mockUpdateChain() as never)
      .mockReturnValueOnce(mockUpdateChain() as never)
      .mockReturnValueOnce(mockUpdateChain() as never)
      .mockReturnValueOnce(mockUpdateChain() as never)

    const drained = await drainSurpriseBonusJobs({ maxBatches: 10 })
    expect(drained.batches).toBe(2)
    expect(drained.last).toMatchObject({ claimed: true, campaignId: "camp-2" })
  })
})
