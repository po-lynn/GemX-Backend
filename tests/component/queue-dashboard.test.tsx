import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { QueueDashboard } from "@/components/admin/queue/QueueDashboard"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

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

describe("QueueDashboard", () => {
  it("shows an empty state only once the fetch genuinely resolves with zero types — not before, and not from the pre-fetch initial render", async () => {
    mockFetchSequence([{ json: { types: [] } }])

    render(<QueueDashboard />)

    // loadTypes runs inside queueMicrotask(...), which cannot have flushed yet at
    // this point (we're still in the same synchronous tick as render()). So the
    // empty-state text must not be showing yet — a broken implementation that
    // renders it unconditionally on the pre-fetch initial state would fail here.
    expect(screen.queryByText("No job types registered yet.")).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()

    // Now let the mocked fetch actually resolve, and confirm the empty state
    // reflects that real resolution (not a coincidence of initial state).
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1))
    expect(await screen.findByText("No job types registered yet.")).toBeInTheDocument()
  })

  it("shows a distinct error state (not the empty state) when loading types fails with a non-ok response", async () => {
    mockFetchSequence([{ ok: false, json: {} }])

    render(<QueueDashboard />)

    expect(await screen.findByText("Couldn't load queue types — try refreshing.")).toBeInTheDocument()
    expect(screen.queryByText("No job types registered yet.")).not.toBeInTheDocument()
  })

  it("shows a distinct error state (not the empty state) when loading types throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))

    render(<QueueDashboard />)

    expect(await screen.findByText("Couldn't load queue types — try refreshing.")).toBeInTheDocument()
    expect(screen.queryByText("No job types registered yet.")).not.toBeInTheDocument()
  })

  it("loads types then the selected type's counts and jobs", async () => {
    mockFetchSequence([
      { json: { types: [{ type: "surprise_bonus_batch", label: "Surprise Bonus" }] } },
      {
        json: {
          counts: { pending: 1, processing: 0, completed: 5, failed: 0, stale: 0 },
          jobs: [
            {
              id: "job-1", status: "completed", isStale: false, attempts: 1, maxAttempts: 5,
              availableAt: "2026-09-08T09:59:00.000Z", lockedAt: null, lockedBy: null, lastError: null,
              createdAt: "2026-09-08T09:58:00.000Z", completedAt: "2026-09-08T10:00:00.000Z",
              description: "Sweet December",
            },
          ],
        },
      },
    ])

    render(<QueueDashboard />)

    expect(await screen.findByText("Sweet December")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Surprise Bonus" })).toBeInTheDocument()
  })

  it("clicking Retry stuck jobs posts to the retry endpoint with the selected type", async () => {
    mockFetchSequence([
      { json: { types: [{ type: "surprise_bonus_batch", label: "Surprise Bonus" }] } },
      { json: { counts: { pending: 0, processing: 1, completed: 0, failed: 0, stale: 1 }, jobs: [] } },
      { json: { success: true, batches: 2 } },
      { json: { types: [{ type: "surprise_bonus_batch", label: "Surprise Bonus" }] } },
      { json: { counts: { pending: 0, processing: 0, completed: 2, failed: 0, stale: 0 }, jobs: [] } },
    ])

    render(<QueueDashboard />)
    await screen.findByRole("button", { name: /retry stuck jobs/i })

    fireEvent.click(screen.getByRole("button", { name: /retry stuck jobs/i }))

    await waitFor(() => {
      const fetchMock = vi.mocked(fetch)
      const retryCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/retry"))
      expect(retryCall).toBeDefined()
      expect(retryCall![1]).toMatchObject({ method: "POST", body: JSON.stringify({ type: "surprise_bonus_batch" }) })
    })
  })
})
