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
  cancelJob,
  claimJob,
  completeJob,
  deleteJob,
  enqueueJob,
  failOrRetryJob,
  getJob,
  getPlatformQueueSummary,
  getQueueTypeSummary,
  listJobs,
  normalizeRows,
  requeueJob,
  setJobDone,
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
  beforeEach(() => vi.clearAllMocks())

  // A completed job's row is deleted outright rather than kept with
  // status: "completed" — see the docstring on completeJob in lib/queue/queue.ts.
  it("deletes the job's row instead of updating its status", async () => {
    const chain = mockDeleteChain([{ id: "job-1" }])
    vi.mocked(db.delete).mockReturnValue(chain as never)

    await completeJob("job-1")

    expect(db.delete).toHaveBeenCalledTimes(1)
    expect(chain.where).toHaveBeenCalledTimes(1)
    expect(db.update).not.toHaveBeenCalled()
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

describe("getJob", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns null when no row matches the id", async () => {
    vi.mocked(db.select).mockReturnValue(mockSelectChain([]) as never)

    expect(await getJob("missing")).toBeNull()
  })

  it("flags a processing job whose lock is older than 3 minutes as stale, same as listJobs", async () => {
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

    const job = await getJob("job-1")
    expect(job).toMatchObject({ id: "job-1", isStale: true })
  })
})

function mockUpdateReturningChain(returned: unknown[]) {
  const chain: Record<string, unknown> = {}
  chain.set = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.returning = vi.fn().mockResolvedValue(returned)
  return chain
}

describe("requeueJob", () => {
  beforeEach(() => vi.clearAllMocks())

  // Manual admin override: works from any status except a still-fresh
  // `processing` lock (guarded in the WHERE clause, not asserted structurally
  // here since the mock chain can't simulate real Postgres filtering — see
  // JobDetailView's isFreshlyProcessing for the equivalent, directly
  // testable UI-side guard).
  it("resets status to pending and clears the lock/lastError, returning true when a row matched", async () => {
    const chain = mockUpdateReturningChain([{ id: "job-1" }])
    vi.mocked(db.update).mockReturnValue(chain as never)

    expect(await requeueJob("job-1")).toBe(true)
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", lockedAt: null, lockedBy: null, lastError: null }),
    )
    expect(chain.where).toHaveBeenCalledTimes(1)
  })

  // Covers both "id doesn't exist" and "processing with a still-fresh
  // lock" — the WHERE clause conflates them into one boolean, matching
  // deleteJob/cancelJob's existing convention.
  it("returns false when the id doesn't exist, or the job is processing with a still-fresh lock", async () => {
    vi.mocked(db.update).mockReturnValue(mockUpdateReturningChain([]) as never)

    expect(await requeueJob("missing-or-mid-flight")).toBe(false)
  })
})

describe("setJobDone", () => {
  beforeEach(() => vi.clearAllMocks())

  // Same trade-off as completeJob: force-completing a job deletes its row
  // rather than setting status: "completed", so no attribution/result is kept.
  it("deletes the job's row and returns true when a row matched", async () => {
    vi.mocked(db.delete).mockReturnValue(mockDeleteChain([{ id: "job-1" }]) as never)

    expect(await setJobDone("job-1")).toBe(true)
    expect(db.update).not.toHaveBeenCalled()
  })

  it("returns false when the id doesn't exist", async () => {
    vi.mocked(db.delete).mockReturnValue(mockDeleteChain([]) as never)

    expect(await setJobDone("missing")).toBe(false)
  })
})

describe("cancelJob", () => {
  beforeEach(() => vi.clearAllMocks())

  it("marks the job cancelled with the given reason as lastError", async () => {
    const chain = mockUpdateReturningChain([{ id: "job-1" }])
    vi.mocked(db.update).mockReturnValue(chain as never)

    expect(await cancelJob("job-1", "Cancelled by admin (admin-1)")).toBe(true)
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled", lastError: "Cancelled by admin (admin-1)" }),
    )
  })

  // The WHERE clause excludes already-`completed` jobs at the query level (see
  // cancelJob's doc comment) — simulated here by the chain resolving no rows,
  // the same signal as a missing id, since both are checked in one query.
  it("returns false when the job doesn't exist or is already completed", async () => {
    vi.mocked(db.update).mockReturnValue(mockUpdateReturningChain([]) as never)

    expect(await cancelJob("job-2", "reason")).toBe(false)
  })
})

function mockExecuteSequence(results: unknown[]) {
  const mock = vi.mocked(db.execute)
  for (const r of results) mock.mockResolvedValueOnce(r as never)
}

const THROUGHPUT_ROWS = [0, 1, 2, 1, 0, 3, 2, 4].map((n, i) => ({ bucket: `2026-09-15T0${i}:00:00Z`, n }))

describe("getQueueTypeSummary", () => {
  beforeEach(() => vi.clearAllMocks())

  it("maps the aggregate row and throughput buckets into a summary, classified healthy", async () => {
    mockExecuteSequence([
      [{
        pending: 0, processing: 0, completed: 5, failed: 0, cancelled: 0, stale: 0,
        failed_24h: 0, completed_24h: 5, p95_seconds: 1.5,
        last_completed_at: "2026-09-15T09:00:00Z", last_created_at: null, oldest_pending_available_at: null,
      }],
      THROUGHPUT_ROWS,
    ])

    const summary = await getQueueTypeSummary("surprise_bonus_batch", "Surprise Bonus")

    expect(summary).toEqual({
      type: "surprise_bonus_batch",
      label: "Surprise Bonus",
      counts: { pending: 0, processing: 0, completed: 5, failed: 0, cancelled: 0, stale: 0 },
      depth: 0,
      failed24h: 0,
      completed24h: 5,
      p95RunTimeMs: 1500,
      throughput: [0, 1, 2, 1, 0, 3, 2, 4],
      lastRunAt: "2026-09-15T09:00:00.000Z",
      oldestPendingAgeMs: null,
      health: "healthy",
    })
  })

  it("classifies a queue with recent failures as failing, even if it also has stale jobs", async () => {
    mockExecuteSequence([
      [{
        pending: 0, processing: 2, completed: 0, failed: 3, cancelled: 0, stale: 2,
        failed_24h: 3, completed_24h: 0, p95_seconds: null,
        last_completed_at: null, last_created_at: "2026-09-15T09:00:00Z", oldest_pending_available_at: null,
      }],
      THROUGHPUT_ROWS,
    ])

    const summary = await getQueueTypeSummary("t", "T")
    expect(summary.health).toBe("failing")
    expect(summary.p95RunTimeMs).toBeNull()
  })

  it("classifies a queue with stale jobs but no recent failures as stale", async () => {
    mockExecuteSequence([
      [{
        pending: 0, processing: 2, completed: 0, failed: 0, cancelled: 0, stale: 2,
        failed_24h: 0, completed_24h: 0, p95_seconds: null,
        last_completed_at: null, last_created_at: null, oldest_pending_available_at: null,
      }],
      THROUGHPUT_ROWS,
    ])

    expect((await getQueueTypeSummary("t", "T")).health).toBe("stale")
  })

  it("classifies a queue with no activity and nothing in flight as idle", async () => {
    mockExecuteSequence([
      [{
        pending: 0, processing: 0, completed: 0, failed: 0, cancelled: 0, stale: 0,
        failed_24h: 0, completed_24h: 0, p95_seconds: null,
        last_completed_at: null, last_created_at: null, oldest_pending_available_at: null,
      }],
      THROUGHPUT_ROWS,
    ])

    expect((await getQueueTypeSummary("t", "T")).health).toBe("idle")
  })

  it("computes oldestPendingAgeMs from the oldest ready-to-run pending job", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-09-15T10:00:00Z"))
    mockExecuteSequence([
      [{
        pending: 1, processing: 0, completed: 0, failed: 0, cancelled: 0, stale: 0,
        failed_24h: 0, completed_24h: 0, p95_seconds: null,
        last_completed_at: null, last_created_at: null, oldest_pending_available_at: "2026-09-15T09:45:00Z",
      }],
      THROUGHPUT_ROWS,
    ])

    expect((await getQueueTypeSummary("t", "T")).oldestPendingAgeMs).toBe(15 * 60 * 1000)
    vi.useRealTimers()
  })
})

describe("getPlatformQueueSummary", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns all-zero defaults without querying when there are no registered types", async () => {
    const summary = await getPlatformQueueSummary([])
    expect(summary).toEqual({
      completed24h: 0, completed24hDeltaPct: null, failed24h: 0, processed24h: 0, failureRatePct: 0,
      p95RunTimeMs: null, throughput: [0, 0, 0, 0, 0, 0, 0, 0], oldestPendingAgeMs: null, oldestPendingType: null,
    })
    expect(db.execute).not.toHaveBeenCalled()
  })

  it("computes the failure rate, delta vs the prior 24h, and the oldest pending job's owning type", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-09-15T10:00:00Z"))
    mockExecuteSequence([
      [{ completed_24h: 8, completed_prev_24h: 4, failed_24h: 2, p95_seconds: 3.2 }],
      [{ type: "push_fanout", available_at: "2026-09-15T09:50:00Z" }],
      THROUGHPUT_ROWS,
    ])

    const summary = await getPlatformQueueSummary(["surprise_bonus_batch", "push_fanout"])

    expect(summary).toEqual({
      completed24h: 8,
      completed24hDeltaPct: 100, // (8 - 4) / 4 * 100
      failed24h: 2,
      processed24h: 10,
      failureRatePct: 20, // 2 / 10 * 100
      p95RunTimeMs: 3200,
      throughput: [0, 1, 2, 1, 0, 3, 2, 4],
      oldestPendingAgeMs: 10 * 60 * 1000,
      oldestPendingType: "push_fanout",
    })
    vi.useRealTimers()
  })

  it("leaves completed24hDeltaPct null when the prior 24h window had zero completions", async () => {
    mockExecuteSequence([
      [{ completed_24h: 3, completed_prev_24h: 0, failed_24h: 0, p95_seconds: null }],
      [],
      THROUGHPUT_ROWS,
    ])

    expect((await getPlatformQueueSummary(["t"])).completed24hDeltaPct).toBeNull()
  })
})
