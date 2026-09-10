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
  sendSurpriseBonusPushToUsers: vi.fn().mockResolvedValue({ sent: 2, failed: 0, invalidTokensRemoved: 0 }),
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
}))

import { sendSurpriseBonusPushToUsers } from "@/features/points/services/surprise-bonus-push"
import { db } from "@/drizzle/db"
import { enqueueJob } from "@/lib/queue/queue"
import { registerQueueJob } from "@/lib/queue/registry"
import { SURPRISE_BONUS_JOB_TYPE } from "@/drizzle/schema/surprise-bonus-schema"
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
    vi.mocked(sendSurpriseBonusPushToUsers).mockResolvedValue({ sent: 2, failed: 0, invalidTokensRemoved: 0 })
  })

  it("throws when the job payload has no campaignId", async () => {
    await expect(processSurpriseBonusJob(claimedJob({}))).rejects.toThrow("Missing campaignId in payload")
  })

  it("grants a batch, sends FCM for newly granted users, completes the campaign", async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([{ result: { granted: true, points: 500 } }] as never)
      .mockResolvedValueOnce([{ result: { granted: true, points: 500 } }] as never)

    const userSelect = mockSelectChain([{ id: "u1" }, { id: "u2" }])
    const campaignSelect = mockSelectChain([
      { name: "Sweet December", pointsPerUser: 500, processedUsers: 0, successCount: 0, failedCount: 0 },
    ])
    vi.mocked(db.select).mockReturnValueOnce(userSelect as never).mockReturnValueOnce(campaignSelect as never)
    vi.mocked(db.update).mockReturnValue(mockUpdateChain() as never)

    await processSurpriseBonusJob(claimedJob({ campaignId: "camp-1", lastUserId: null }))

    expect(sendSurpriseBonusPushToUsers).toHaveBeenCalledWith({
      userIds: ["u1", "u2"],
      campaignId: "camp-1",
      campaignName: "Sweet December",
      pointsPerUser: 500,
    })
    expect(enqueueJob).not.toHaveBeenCalled()
  })

  it("does not push for already_granted users", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([{ result: { granted: false, reason: "already_granted" } }] as never)

    const userSelect = mockSelectChain([{ id: "u1" }])
    const campaignSelect = mockSelectChain([
      { name: "Sweet December", pointsPerUser: 500, processedUsers: 0, successCount: 0, failedCount: 0 },
    ])
    vi.mocked(db.select).mockReturnValueOnce(userSelect as never).mockReturnValueOnce(campaignSelect as never)
    vi.mocked(db.update).mockReturnValue(mockUpdateChain() as never)

    await processSurpriseBonusJob(claimedJob({ campaignId: "camp-1", lastUserId: null }))
    expect(sendSurpriseBonusPushToUsers).not.toHaveBeenCalled()
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
  })
})
