import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/drizzle/db", () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

import { db } from "@/drizzle/db"
import {
  claimJob,
  completeJob,
  deleteJob,
  enqueueJob,
  failOrRetryJob,
  getJobStatusCounts,
  listJobs,
  normalizeRows,
} from "@/lib/queue/queue"

function mockInsertChain(row: unknown) {
  const chain: Record<string, unknown> = {}
  chain.values = vi.fn().mockReturnValue(chain)
  chain.returning = vi.fn().mockResolvedValue([row])
  return chain
}

function mockUpdateChain() {
  const chain: Record<string, unknown> = {}
  chain.set = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockResolvedValue(undefined)
  return chain
}

function mockSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockResolvedValue(rows)
  return chain
}

describe("normalizeRows", () => {
  it("returns a plain array unchanged", () => {
    expect(normalizeRows([{ a: 1 }])).toEqual([{ a: 1 }])
  })

  it("unwraps a { rows } result shape", () => {
    expect(normalizeRows({ rows: [{ a: 1 }] })).toEqual([{ a: 1 }])
  })

  it("spreads an iterable result (postgres-js RowList)", () => {
    const source = [{ a: 1 }]
    const iterable = { [Symbol.iterator]: () => source[Symbol.iterator]() }
    expect(normalizeRows(iterable)).toEqual([{ a: 1 }])
  })

  it("returns an empty array for null/undefined", () => {
    expect(normalizeRows(null)).toEqual([])
    expect(normalizeRows(undefined)).toEqual([])
  })
})

describe("enqueueJob", () => {
  beforeEach(() => vi.clearAllMocks())

  it("inserts a pending job with default maxAttempts and availableAt=now", async () => {
    const chain = mockInsertChain({ id: "job-1" })
    vi.mocked(db.insert).mockReturnValue(chain as never)

    const result = await enqueueJob("my_type", { foo: "bar" })

    expect(result).toEqual({ id: "job-1" })
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "my_type",
        payload: { foo: "bar" },
        status: "pending",
        attempts: 0,
        maxAttempts: 5,
      }),
    )
  })

  it("honors an explicit maxAttempts and availableAt", async () => {
    const chain = mockInsertChain({ id: "job-2" })
    vi.mocked(db.insert).mockReturnValue(chain as never)
    const availableAt = new Date("2026-10-01T00:00:00Z")

    await enqueueJob("my_type", {}, { maxAttempts: 3, availableAt })

    expect(chain.values).toHaveBeenCalledWith(expect.objectContaining({ maxAttempts: 3, availableAt }))
  })
})

describe("claimJob", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns null when nothing is claimable", async () => {
    vi.mocked(db.execute).mockResolvedValue([] as never)
    const job = await claimJob("my_type", "worker-1")
    expect(job).toBeNull()
  })

  it("returns the claimed job with a parsed payload", async () => {
    vi.mocked(db.execute).mockResolvedValue([
      { id: "job-1", type: "my_type", payload: { a: 1 }, attempts: 1, max_attempts: 5 },
    ] as never)

    const job = await claimJob("my_type", "worker-1")
    expect(job).toEqual({ id: "job-1", type: "my_type", payload: { a: 1 }, attempts: 1, maxAttempts: 5 })
  })

  it("parses a JSON-string payload (raw postgres text column)", async () => {
    vi.mocked(db.execute).mockResolvedValue([
      { id: "job-1", type: "my_type", payload: '{"a":1}', attempts: 1, max_attempts: 5 },
    ] as never)

    const job = await claimJob("my_type", "worker-1")
    expect(job?.payload).toEqual({ a: 1 })
  })
})

describe("completeJob", () => {
  it("marks the job completed, clears the lock, and defaults result to null", async () => {
    const chain = mockUpdateChain()
    vi.mocked(db.update).mockReturnValue(chain as never)

    await completeJob("job-1")

    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed", lockedAt: null, lockedBy: null, result: null }),
    )
  })

  it("persists a handler's returned result object", async () => {
    const chain = mockUpdateChain()
    vi.mocked(db.update).mockReturnValue(chain as never)

    await completeJob("job-1", { credited: 48, failed: 2 })

    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ result: { credited: 48, failed: 2 } }))
  })
})

describe("failOrRetryJob", () => {
  beforeEach(() => vi.clearAllMocks())

  it("retries with default backoff (min(attempts*2, 30) minutes) when attempts remain", async () => {
    const chain = mockUpdateChain()
    vi.mocked(db.update).mockReturnValue(chain as never)

    await failOrRetryJob({ id: "job-1", type: "t", payload: {}, attempts: 2, maxAttempts: 5 }, "boom")

    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", lastError: "boom", lockedAt: null, lockedBy: null }),
    )
    const setArg = (chain.set as ReturnType<typeof vi.fn>).mock.calls[0][0] as { availableAt: Date }
    expect(setArg.availableAt.getTime()).toBeGreaterThan(Date.now() + 3.9 * 60_000)
    expect(setArg.availableAt.getTime()).toBeLessThan(Date.now() + 4.1 * 60_000)
  })

  it("marks failed once attempts reach maxAttempts", async () => {
    const chain = mockUpdateChain()
    vi.mocked(db.update).mockReturnValue(chain as never)

    await failOrRetryJob({ id: "job-1", type: "t", payload: {}, attempts: 5, maxAttempts: 5 }, "boom")

    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", lastError: "boom", lockedAt: null, lockedBy: null }),
    )
  })

  it("honors a custom backoff function", async () => {
    const chain = mockUpdateChain()
    vi.mocked(db.update).mockReturnValue(chain as never)

    await failOrRetryJob(
      { id: "job-1", type: "t", payload: {}, attempts: 1, maxAttempts: 5 },
      "boom",
      { backoffMinutes: () => 1 },
    )

    const setArg = (chain.set as ReturnType<typeof vi.fn>).mock.calls[0][0] as { availableAt: Date }
    expect(setArg.availableAt.getTime()).toBeGreaterThan(Date.now() + 0.9 * 60_000)
    expect(setArg.availableAt.getTime()).toBeLessThan(Date.now() + 1.1 * 60_000)
  })
})

describe("listJobs", () => {
  beforeEach(() => vi.clearAllMocks())

  it("flags a processing job whose lock is older than 3 minutes as stale", async () => {
    const fourMinutesAgo = new Date(Date.now() - 4 * 60_000)
    vi.mocked(db.select).mockReturnValue(
      mockSelectChain([
        {
          id: "job-1", type: "t", payload: {}, status: "processing", attempts: 1, maxAttempts: 5,
          availableAt: new Date(), lockedAt: fourMinutesAgo, lockedBy: "worker-1", lastError: null,
          createdAt: new Date(), completedAt: null,
        },
      ]) as never,
    )

    const rows = await listJobs("t")
    expect(rows[0]).toMatchObject({ id: "job-1", isStale: true })
  })

  it("does not flag a processing job locked less than 3 minutes ago", async () => {
    const oneMinuteAgo = new Date(Date.now() - 60_000)
    vi.mocked(db.select).mockReturnValue(
      mockSelectChain([
        {
          id: "job-2", type: "t", payload: {}, status: "processing", attempts: 1, maxAttempts: 5,
          availableAt: new Date(), lockedAt: oneMinuteAgo, lockedBy: "worker-1", lastError: null,
          createdAt: new Date(), completedAt: null,
        },
      ]) as never,
    )

    const rows = await listJobs("t")
    expect(rows[0]).toMatchObject({ id: "job-2", isStale: false })
  })

  it("never flags completed/pending/failed jobs as stale, regardless of lockedAt", async () => {
    const longAgo = new Date(Date.now() - 60 * 60_000)
    vi.mocked(db.select).mockReturnValue(
      mockSelectChain([
        {
          id: "job-3", type: "t", payload: {}, status: "completed", attempts: 1, maxAttempts: 5,
          availableAt: new Date(), lockedAt: longAgo, lockedBy: null, lastError: null,
          createdAt: new Date(), completedAt: new Date(),
        },
      ]) as never,
    )

    const rows = await listJobs("t")
    expect(rows[0]).toMatchObject({ id: "job-3", isStale: false })
  })

  it("does not flag a processing job with no lockedAt as stale", async () => {
    vi.mocked(db.select).mockReturnValue(
      mockSelectChain([
        {
          id: "job-4", type: "t", payload: {}, status: "processing", attempts: 0, maxAttempts: 5,
          availableAt: new Date(), lockedAt: null, lockedBy: null, lastError: null,
          createdAt: new Date(), completedAt: null,
        },
      ]) as never,
    )

    const rows = await listJobs("t")
    expect(rows[0]).toMatchObject({ id: "job-4", isStale: false })
  })

  it("passes through a stored result object unchanged", async () => {
    vi.mocked(db.select).mockReturnValue(
      mockSelectChain([
        {
          id: "job-5", type: "t", payload: {}, status: "completed", attempts: 1, maxAttempts: 5,
          availableAt: new Date(), lockedAt: null, lockedBy: null, lastError: null,
          result: { credited: 48, failed: 2 }, createdAt: new Date(), completedAt: new Date(),
        },
      ]) as never,
    )

    const rows = await listJobs("t")
    expect(rows[0]?.result).toEqual({ credited: 48, failed: 2 })
  })
})

describe("getJobStatusCounts", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns the counts row from the grouped query", async () => {
    const chain: Record<string, unknown> = {}
    chain.from = vi.fn().mockReturnValue(chain)
    chain.where = vi.fn().mockResolvedValue([{ pending: 2, processing: 1, completed: 40, failed: 0, stale: 1 }])
    vi.mocked(db.select).mockReturnValue(chain as never)

    const counts = await getJobStatusCounts("t")
    expect(counts).toEqual({ pending: 2, processing: 1, completed: 40, failed: 0, stale: 1 })
  })

  it("falls back to all-zero counts when the query returns no row", async () => {
    const chain: Record<string, unknown> = {}
    chain.from = vi.fn().mockReturnValue(chain)
    chain.where = vi.fn().mockResolvedValue([])
    vi.mocked(db.select).mockReturnValue(chain as never)

    const counts = await getJobStatusCounts("t")
    expect(counts).toEqual({ pending: 0, processing: 0, completed: 0, failed: 0, stale: 0 })
  })
})

function mockDeleteChain(returned: unknown[]) {
  const chain: Record<string, unknown> = {}
  chain.where = vi.fn().mockReturnValue(chain)
  chain.returning = vi.fn().mockResolvedValue(returned)
  return chain
}

describe("deleteJob", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns true when a completed/failed job row is deleted", async () => {
    vi.mocked(db.delete).mockReturnValue(mockDeleteChain([{ id: "job-1" }]) as never)

    expect(await deleteJob("job-1")).toBe(true)
  })

  it("returns false when nothing matched (wrong id, or job is pending/processing)", async () => {
    vi.mocked(db.delete).mockReturnValue(mockDeleteChain([]) as never)

    expect(await deleteJob("job-2")).toBe(false)
  })
})
