import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/drizzle/db", () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/lib/queue/queue", () => ({
  enqueueJob: vi.fn(),
  normalizeRows: (result: unknown) => (Array.isArray(result) ? result : []),
}))

vi.mock("@/lib/queue/registry", () => ({
  registerQueueJob: vi.fn(),
}))

vi.mock("@/features/points/db/surprise-bonus", () => ({
  describeSurpriseBonusJobs: vi.fn(),
  listSurpriseBonusTransactions: vi.fn(),
}))

import { db } from "@/drizzle/db"
import { enqueueJob } from "@/lib/queue/queue"
import { registerQueueJob } from "@/lib/queue/registry"
import { SURPRISE_BONUS_JOB_TYPE, SURPRISE_BONUS_PUSH_JOB_TYPE } from "@/drizzle/schema/surprise-bonus-schema"
import { processSurpriseBonusJob } from "@/features/points/services/process-surprise-bonus-jobs"

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

function claimedJob(payload: { campaignId?: string; lastUserId?: string | null }) {
  return { id: "job-1", type: SURPRISE_BONUS_JOB_TYPE, payload, attempts: 1, maxAttempts: 5 }
}

it("registers itself as the surprise_bonus_batch queue job handler on import", () => {
  expect(registerQueueJob).toHaveBeenCalledWith(
    expect.objectContaining({
      type: SURPRISE_BONUS_JOB_TYPE,
      label: "Surprise Bonus",
      handler: processSurpriseBonusJob,
    }),
  )
})

describe("processSurpriseBonusJob", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("throws when the job payload has no campaignId", async () => {
    await expect(processSurpriseBonusJob(claimedJob({}))).rejects.toThrow("Missing campaignId in payload")
  })

  it("grants a batch, enqueues a push job for newly granted users, completes the campaign", async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([{ result: { granted: true, points: 500 } }] as never)
      .mockResolvedValueOnce([{ result: { granted: true, points: 500 } }] as never)

    const userSelect = mockSelectChain([{ id: "u1" }, { id: "u2" }])
    const campaignSelect = mockSelectChain([
      { name: "Sweet December", pointsPerUser: 500, processedUsers: 0, successCount: 0, failedCount: 0 },
    ])
    vi.mocked(db.select).mockReturnValueOnce(userSelect as never).mockReturnValueOnce(campaignSelect as never)
    vi.mocked(db.update).mockReturnValue(mockUpdateChain() as never)

    const result = await processSurpriseBonusJob(claimedJob({ campaignId: "camp-1", lastUserId: null }))

    expect(enqueueJob).toHaveBeenCalledWith(SURPRISE_BONUS_PUSH_JOB_TYPE, {
      campaignId: "camp-1",
      campaignName: "Sweet December",
      pointsPerUser: 500,
      userIds: ["u1", "u2"],
    })
    expect(enqueueJob).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ batchUsers: 2, newlyGranted: 2, alreadyGranted: 0, failed: 0, pushJobEnqueued: true })
  })

  it("does not enqueue a push job for already_granted users", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([{ result: { granted: false, reason: "already_granted" } }] as never)

    const userSelect = mockSelectChain([{ id: "u1" }])
    const campaignSelect = mockSelectChain([
      { name: "Sweet December", pointsPerUser: 500, processedUsers: 0, successCount: 0, failedCount: 0 },
    ])
    vi.mocked(db.select).mockReturnValueOnce(userSelect as never).mockReturnValueOnce(campaignSelect as never)
    vi.mocked(db.update).mockReturnValue(mockUpdateChain() as never)

    const result = await processSurpriseBonusJob(claimedJob({ campaignId: "camp-1", lastUserId: null }))
    expect(enqueueJob).not.toHaveBeenCalled()
    expect(result).toEqual({ batchUsers: 1, newlyGranted: 0, alreadyGranted: 1, failed: 0, pushJobEnqueued: false })
  })

  it("chains the next batch via enqueueJob when a full batch (more users remain) is processed", async () => {
    const fullBatch = Array.from({ length: 100 }, (_, i) => ({ id: `u${i}` }))
    vi.mocked(db.execute).mockResolvedValue([{ result: { granted: true, points: 10 } }] as never)

    const userSelect = mockSelectChain(fullBatch)
    const campaignSelect = mockSelectChain([
      { name: "X", pointsPerUser: 10, processedUsers: 0, successCount: 0, failedCount: 0 },
    ])
    vi.mocked(db.select).mockReturnValueOnce(userSelect as never).mockReturnValueOnce(campaignSelect as never)
    vi.mocked(db.update).mockReturnValue(mockUpdateChain() as never)

    await processSurpriseBonusJob(claimedJob({ campaignId: "camp-1", lastUserId: null }))

    expect(enqueueJob).toHaveBeenCalledWith(SURPRISE_BONUS_JOB_TYPE, { campaignId: "camp-1", lastUserId: "u99" })
    expect(enqueueJob).toHaveBeenCalledWith(
      SURPRISE_BONUS_PUSH_JOB_TYPE,
      expect.objectContaining({ campaignId: "camp-1", userIds: fullBatch.map((u) => u.id) }),
    )
  })
})
