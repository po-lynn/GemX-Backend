import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { toast } from "sonner"
import { QueueOverview } from "@/components/admin/queue/QueueOverview"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const thresholds = { pendingAgeAlertMs: 15 * 60 * 1000, failureRateSloPct: 1, staleAfterMs: 3 * 60 * 1000, maxAttempts: 5 }
const platform = {
  completed24h: 10, completed24hDeltaPct: 5, failed24h: 0, processed24h: 10, failureRatePct: 0,
  p95RunTimeMs: 2000, throughput: [1, 2, 3, 4, 5, 6, 7, 8], oldestPendingAgeMs: null, oldestPendingType: null,
}

function summary(overrides: Record<string, unknown> = {}) {
  return {
    type: "surprise_bonus_batch",
    label: "Surprise Bonus",
    counts: { pending: 0, processing: 0, completed: 10, failed: 0, cancelled: 0, stale: 0 },
    depth: 0,
    failed24h: 0,
    completed24h: 10,
    p95RunTimeMs: 1400,
    throughput: [1, 2, 3, 4, 5, 6, 7, 8],
    lastRunAt: "2026-09-15T09:30:00.000Z",
    oldestPendingAgeMs: null,
    health: "healthy",
    ...overrides,
  }
}

function mockFetchSequence(responses: Array<{ ok?: boolean; json: unknown }>) {
  let call = 0
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const r = responses[Math.min(call, responses.length - 1)]!
      call++
      return { ok: r.ok ?? true, json: async () => r.json }
    }),
  )
}

describe("QueueOverview", () => {
  it("shows a distinct error state when the overview fetch fails", async () => {
    mockFetchSequence([{ ok: false, json: {} }])
    render(<QueueOverview />)
    expect(await screen.findByText(/Couldn't load the queue overview/)).toBeInTheDocument()
  })

  it("renders each registered queue's health, depth and failed count", async () => {
    mockFetchSequence([
      { json: { summaries: [summary()], platform, checkedAt: "2026-09-15T09:32:00.000Z", thresholds } },
    ])
    render(<QueueOverview />)

    expect(await screen.findByText("Surprise Bonus")).toBeInTheDocument()
    expect(screen.getByText("Healthy")).toBeInTheDocument()
    expect(screen.getByText("surprise_bonus_batch")).toBeInTheDocument()
  })

  it("shows no alert banner when every queue is healthy", async () => {
    mockFetchSequence([
      { json: { summaries: [summary()], platform, checkedAt: "2026-09-15T09:32:00.000Z", thresholds } },
    ])
    render(<QueueOverview />)

    await screen.findByText("Surprise Bonus")
    expect(screen.queryByText(/Retry all/)).not.toBeInTheDocument()
  })

  it("shows the failing alert banner and its real 24h failure count when a queue is failing", async () => {
    mockFetchSequence([
      {
        json: {
          summaries: [summary({ health: "failing", failed24h: 4, counts: { pending: 0, processing: 0, completed: 6, failed: 4, cancelled: 0, stale: 0 } })],
          platform, checkedAt: "2026-09-15T09:32:00.000Z", thresholds,
        },
      },
    ])
    render(<QueueOverview />)

    expect(await screen.findByText("4 jobs failed in Surprise Bonus in the last 24 hours")).toBeInTheDocument()
    expect(screen.getByText("Retry all")).toBeInTheDocument()
  })

  it("Retry stuck jobs skips queues with zero stale jobs and shows an info toast", async () => {
    mockFetchSequence([
      { json: { summaries: [summary()], platform, checkedAt: "2026-09-15T09:32:00.000Z", thresholds } },
    ])
    render(<QueueOverview />)
    await screen.findByText("Surprise Bonus")

    fireEvent.click(screen.getByRole("button", { name: /Retry stuck jobs/ }))

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("Nothing to retry — no queue currently has stale jobs"))
    // Only the initial overview GET should have fired — no POST to /retry.
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST")).toBe(false)
  })

  it("Retry stuck jobs only retries queues that actually have stale jobs", async () => {
    mockFetchSequence([
      {
        json: {
          summaries: [
            summary({ type: "surprise_bonus_batch", label: "Surprise Bonus", counts: { pending: 0, processing: 2, completed: 0, failed: 0, cancelled: 0, stale: 2 }, health: "stale" }),
            summary({ type: "push_fanout", label: "Push Notifications", counts: { pending: 0, processing: 0, completed: 0, failed: 0, cancelled: 0, stale: 0 }, health: "healthy" }),
          ],
          platform, checkedAt: "2026-09-15T09:32:00.000Z", thresholds,
        },
      },
      { json: { success: true, batches: 1 } },
      { json: { summaries: [], platform, checkedAt: "2026-09-15T09:33:00.000Z", thresholds } },
    ])
    render(<QueueOverview />)
    await screen.findByText("Surprise Bonus")

    fireEvent.click(screen.getByRole("button", { name: /Retry stuck jobs/ }))

    await waitFor(() => {
      const retryCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes("/api/admin/queue/retry"))
      expect(retryCall).toBeDefined()
      expect(retryCall![1]).toMatchObject({ method: "POST", body: JSON.stringify({ type: "surprise_bonus_batch" }) })
    })
    // Exactly one retry POST — the healthy queue must not be retried.
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("/api/admin/queue/retry"))).toHaveLength(1)
  })
})
