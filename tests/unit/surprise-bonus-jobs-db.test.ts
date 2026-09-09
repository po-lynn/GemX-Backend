import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(),
  },
}))

import { db } from "@/drizzle/db"
import {
  listSurpriseBonusJobs,
  getSurpriseBonusJobStatusCounts,
} from "@/features/points/db/surprise-bonus"

function mockSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  chain.from = vi.fn().mockReturnValue(chain)
  chain.leftJoin = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockResolvedValue(rows)
  return chain
}

describe("listSurpriseBonusJobs", () => {
  beforeEach(() => vi.clearAllMocks())

  it("flags a processing job whose lock is older than 3 minutes as stale", async () => {
    const fourMinutesAgo = new Date(Date.now() - 4 * 60_000)
    vi.mocked(db.select).mockReturnValue(
      mockSelectChain([
        {
          id: "job-1",
          status: "processing",
          attempts: 1,
          maxAttempts: 5,
          availableAt: new Date(),
          lockedAt: fourMinutesAgo,
          lockedBy: "worker-1",
          lastError: null,
          createdAt: new Date(),
          completedAt: null,
          campaignId: "camp-1",
          campaignName: "Sweet December",
        },
      ]) as never,
    )

    const rows = await listSurpriseBonusJobs()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: "job-1", status: "processing", isStale: true })
  })

  it("does not flag a processing job locked less than 3 minutes ago", async () => {
    const oneMinuteAgo = new Date(Date.now() - 60_000)
    vi.mocked(db.select).mockReturnValue(
      mockSelectChain([
        {
          id: "job-2",
          status: "processing",
          attempts: 1,
          maxAttempts: 5,
          availableAt: new Date(),
          lockedAt: oneMinuteAgo,
          lockedBy: "worker-1",
          lastError: null,
          createdAt: new Date(),
          completedAt: null,
          campaignId: "camp-1",
          campaignName: "Sweet December",
        },
      ]) as never,
    )

    const rows = await listSurpriseBonusJobs()
    expect(rows[0]).toMatchObject({ id: "job-2", isStale: false })
  })

  it("never flags completed/pending/failed jobs as stale, regardless of lockedAt", async () => {
    const longAgo = new Date(Date.now() - 60 * 60_000)
    vi.mocked(db.select).mockReturnValue(
      mockSelectChain([
        {
          id: "job-3",
          status: "completed",
          attempts: 1,
          maxAttempts: 5,
          availableAt: new Date(),
          lockedAt: longAgo,
          lockedBy: null,
          lastError: null,
          createdAt: new Date(),
          completedAt: new Date(),
          campaignId: "camp-1",
          campaignName: "Sweet December",
        },
      ]) as never,
    )

    const rows = await listSurpriseBonusJobs()
    expect(rows[0]).toMatchObject({ id: "job-3", isStale: false })
  })

  it("does not flag a processing job with no lockedAt as stale", async () => {
    vi.mocked(db.select).mockReturnValue(
      mockSelectChain([
        {
          id: "job-4",
          status: "processing",
          attempts: 0,
          maxAttempts: 5,
          availableAt: new Date(),
          lockedAt: null,
          lockedBy: null,
          lastError: null,
          createdAt: new Date(),
          completedAt: null,
          campaignId: null,
          campaignName: null,
        },
      ]) as never,
    )

    const rows = await listSurpriseBonusJobs()
    expect(rows[0]).toMatchObject({ id: "job-4", isStale: false })
  })
})

describe("getSurpriseBonusJobStatusCounts", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns the counts row from the grouped query", async () => {
    const chain: Record<string, unknown> = {}
    chain.from = vi.fn().mockReturnValue(chain)
    chain.where = vi.fn().mockResolvedValue([
      { pending: 2, processing: 1, completed: 40, failed: 0, stale: 1 },
    ])
    vi.mocked(db.select).mockReturnValue(chain as never)

    const counts = await getSurpriseBonusJobStatusCounts()
    expect(counts).toEqual({ pending: 2, processing: 1, completed: 40, failed: 0, stale: 1 })
  })

  it("falls back to all-zero counts when the query returns no row", async () => {
    const chain: Record<string, unknown> = {}
    chain.from = vi.fn().mockReturnValue(chain)
    chain.where = vi.fn().mockResolvedValue([])
    vi.mocked(db.select).mockReturnValue(chain as never)

    const counts = await getSurpriseBonusJobStatusCounts()
    expect(counts).toEqual({ pending: 0, processing: 0, completed: 0, failed: 0, stale: 0 })
  })
})
