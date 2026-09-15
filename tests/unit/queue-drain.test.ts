import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/queue/queue", () => ({
  claimJob: vi.fn(),
  completeJob: vi.fn(),
  failOrRetryJob: vi.fn(),
}))

import { claimJob, completeJob, failOrRetryJob } from "@/lib/queue/queue"
import { drainJobs } from "@/lib/queue/drain"

describe("drainJobs", () => {
  beforeEach(() => vi.clearAllMocks())

  it("stops once the queue has no more claimable jobs", async () => {
    vi.mocked(claimJob)
      .mockResolvedValueOnce({ id: "job-1", type: "t", payload: {}, attempts: 1, maxAttempts: 5 })
      .mockResolvedValueOnce(null)

    const handler = vi.fn().mockResolvedValue(undefined)
    const result = await drainJobs("t", handler)

    expect(result).toEqual({ batches: 1 })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(completeJob).toHaveBeenCalledWith("job-1")
  })

  // completeJob now deletes the job's row (see lib/queue/queue.ts), so a
  // handler's return value has nowhere to go — drain ignores it entirely.
  it("ignores a handler's returned result — completeJob deletes the row regardless", async () => {
    vi.mocked(claimJob)
      .mockResolvedValueOnce({ id: "job-1", type: "t", payload: {}, attempts: 1, maxAttempts: 5 })
      .mockResolvedValueOnce(null)

    const handler = vi.fn().mockResolvedValue({ credited: 48 })
    await drainJobs("t", handler)

    expect(completeJob).toHaveBeenCalledWith("job-1")
  })

  it("stops after maxBatches even if more jobs are claimable", async () => {
    vi.mocked(claimJob).mockResolvedValue({ id: "job-x", type: "t", payload: {}, attempts: 1, maxAttempts: 5 })
    const handler = vi.fn().mockResolvedValue(undefined)

    const result = await drainJobs("t", handler, { maxBatches: 3 })

    expect(result).toEqual({ batches: 3 })
    expect(handler).toHaveBeenCalledTimes(3)
  })

  it("records the failure via failOrRetryJob and rethrows, aborting the drain", async () => {
    vi.mocked(claimJob).mockResolvedValueOnce({ id: "job-1", type: "t", payload: {}, attempts: 1, maxAttempts: 5 })

    const handler = vi.fn().mockRejectedValueOnce(new Error("boom"))

    await expect(drainJobs("t", handler)).rejects.toThrow("boom")

    expect(claimJob).toHaveBeenCalledTimes(1)
    expect(failOrRetryJob).toHaveBeenCalledWith(
      { id: "job-1", type: "t", payload: {}, attempts: 1, maxAttempts: 5 },
      "boom",
    )
    expect(completeJob).not.toHaveBeenCalled()
  })

  it("passes a custom lockedBy through to claimJob", async () => {
    vi.mocked(claimJob).mockResolvedValueOnce(null)
    await drainJobs("t", vi.fn(), { lockedBy: "worker-42" })
    expect(claimJob).toHaveBeenCalledWith("t", "worker-42")
  })
})
