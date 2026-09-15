import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"

const push = vi.fn()
const refresh = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "sonner"
import { JobDetailView, type JobDetail } from "@/components/admin/queue/JobDetailView"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  push.mockClear()
  refresh.mockClear()
})

function baseJob(overrides: Partial<JobDetail> = {}): JobDetail {
  return {
    id: "job-1",
    type: "surprise_bonus_batch",
    label: "Surprise Bonus",
    status: "failed",
    isStale: false,
    attempts: 5,
    maxAttempts: 5,
    availableAt: "2026-09-14T09:59:00.000Z",
    lockedAt: null,
    lockedBy: null,
    lastError: "grant_surprise_bonus_user: relation missing",
    result: null,
    payload: { campaignId: "campaign-1", lastUserId: "user-99" },
    createdAt: "2026-09-14T09:58:00.000Z",
    completedAt: "2026-09-14T10:00:00.000Z",
    description: null,
    ...overrides,
  }
}

function mockFetchOnce(response: { ok?: boolean; json: unknown }) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: response.ok ?? true, json: async () => response.json })))
}

describe("JobDetailView", () => {
  it("renders the job's fields, last error, and raw payload", () => {
    render(<JobDetailView job={baseJob()} />)

    expect(screen.getByText("grant_surprise_bonus_user: relation missing")).toBeInTheDocument()
    expect(screen.getByText(/attempt 5 \/ 5/)).toBeInTheDocument()
    expect(screen.getByText(/"campaignId": "campaign-1"/)).toBeInTheDocument()
  })

  it("shows the fallback message when a completed job has no result", () => {
    render(<JobDetailView job={baseJob({ status: "completed", result: null })} />)
    expect(screen.getByText("No result recorded")).toBeInTheDocument()
  })

  it("renders a completed job's result in its lifecycle step", () => {
    render(<JobDetailView job={baseJob({ status: "completed", result: { newlyGranted: 48, failed: 2 } })} />)
    expect(screen.getByText(/Newly Granted: 48/)).toBeInTheDocument()
  })

  it("clicking Retry now posts to the requeue endpoint and refreshes on success", async () => {
    mockFetchOnce({ json: { success: true, id: "job-1" } })
    render(<JobDetailView job={baseJob()} />)

    fireEvent.click(screen.getByRole("button", { name: /Retry now/ }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/admin/queue/job-1/requeue", { method: "POST" })
      expect(refresh).toHaveBeenCalledTimes(1)
    })
  })

  it("shows an error toast and does not refresh when the requeue call fails", async () => {
    mockFetchOnce({ ok: false, json: { error: "Job not found" } })
    render(<JobDetailView job={baseJob()} />)

    fireEvent.click(screen.getByRole("button", { name: /Retry now/ }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Job not found"))
    expect(refresh).not.toHaveBeenCalled()
  })

  // setJobDone deletes the job's row, so a successful "done" navigates away
  // (like delete) instead of refreshing a page that would now 404.
  it("Mark done asks for confirmation, then posts to the done endpoint and navigates back to the queue", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true))
    mockFetchOnce({ json: { success: true, id: "job-1" } })
    render(<JobDetailView job={baseJob()} />)

    fireEvent.click(screen.getByRole("button", { name: /Mark done/ }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/admin/queue/job-1/done", { method: "POST" })
      expect(push).toHaveBeenCalledWith("/admin/queue")
    })
    expect(refresh).not.toHaveBeenCalled()
  })

  it("Mark done does nothing when the confirmation is dismissed", () => {
    vi.stubGlobal("confirm", vi.fn(() => false))
    vi.stubGlobal("fetch", vi.fn())
    render(<JobDetailView job={baseJob()} />)

    fireEvent.click(screen.getByRole("button", { name: /Mark done/ }))

    expect(fetch).not.toHaveBeenCalled()
  })

  it("Cancel job is disabled once the job is already completed", () => {
    render(<JobDetailView job={baseJob({ status: "completed" })} />)
    expect(screen.getByRole("button", { name: /Cancel job/ })).toBeDisabled()
  })

  // Regression: requeuing a job a live worker is still executing can cause
  // two workers to process the same batch concurrently (see requeueJob's
  // doc comment in lib/queue/queue.ts) — the button must stay disabled while
  // that risk is real, i.e. status is "processing" and the lock isn't stale.
  it("Retry now is disabled while the job is processing with a still-fresh (non-stale) lock", () => {
    render(<JobDetailView job={baseJob({ status: "processing", isStale: false })} />)
    expect(screen.getByRole("button", { name: /Retry now/ })).toBeDisabled()
  })

  it("Retry now is enabled once a processing job's lock has gone stale", () => {
    render(<JobDetailView job={baseJob({ status: "processing", isStale: true })} />)
    expect(screen.getByRole("button", { name: /Retry now/ })).not.toBeDisabled()
  })

  it("Cancel job is enabled (and posts to the cancel endpoint) for a failed job", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true))
    mockFetchOnce({ json: { success: true, id: "job-1" } })
    render(<JobDetailView job={baseJob({ status: "failed" })} />)

    const cancelBtn = screen.getByRole("button", { name: /Cancel job/ })
    expect(cancelBtn).not.toBeDisabled()
    fireEvent.click(cancelBtn)

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/queue/job-1/cancel", { method: "POST" }))
  })

  it("shows Delete only for a terminal job (completed/failed/cancelled), not pending/processing", () => {
    const { rerender } = render(<JobDetailView job={baseJob({ status: "pending" })} />)
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument()

    rerender(<JobDetailView job={baseJob({ status: "failed" })} />)
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument()
  })

  it("clicking Delete, after confirming, calls DELETE and navigates back to the queue list", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true))
    mockFetchOnce({ json: { success: true, id: "job-1" } })
    render(<JobDetailView job={baseJob({ status: "failed" })} />)

    fireEvent.click(screen.getByRole("button", { name: "Delete" }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/admin/queue/job-1", { method: "DELETE" })
      expect(push).toHaveBeenCalledWith("/admin/queue")
    })
  })
})
