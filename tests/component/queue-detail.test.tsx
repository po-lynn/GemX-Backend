import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

let mockSearchParams = new URLSearchParams()
const replace = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/admin/queue/surprise_bonus_batch",
  useSearchParams: () => mockSearchParams,
}))

import { QueueDetail } from "@/components/admin/queue/QueueDetail"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  replace.mockClear()
  mockSearchParams = new URLSearchParams()
})

const summary = { health: "healthy" as const, counts: { pending: 0, processing: 0, completed: 1, failed: 0, cancelled: 0, stale: 0 } }

function detailResponse(overrides: Record<string, unknown> = {}) {
  return {
    label: "Surprise Bonus",
    counts: { pending: 0, processing: 0, completed: 1, failed: 0, cancelled: 0, stale: 0 },
    summary,
    jobs: [],
    ...overrides,
  }
}

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1", status: "completed", isStale: false, attempts: 1, maxAttempts: 5,
    lockedAt: null, lockedBy: null, lastError: null, result: null,
    createdAt: "2026-09-08T09:58:00.000Z", completedAt: "2026-09-08T10:00:00.000Z",
    description: "Sweet December",
    ...overrides,
  }
}

function mockFetchSequence(responses: Array<{ ok?: boolean; status?: number; json: unknown }>) {
  let call = 0
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const r = responses[Math.min(call, responses.length - 1)]!
      call++
      return { ok: r.ok ?? true, status: r.status ?? (r.ok === false ? 500 : 200), json: async () => r.json }
    }),
  )
}

describe("QueueDetail", () => {
  it("shows an unknown-queue message on a 404 from the API", async () => {
    mockFetchSequence([{ ok: false, status: 404, json: { error: "Unknown job type" } }])
    render(<QueueDetail type="ghost_queue" />)
    expect(await screen.findByText(/Unknown queue type/)).toBeInTheDocument()
  })

  it("renders the queue's label, health pill, and status strip counts", async () => {
    mockFetchSequence([{ json: detailResponse() }])
    render(<QueueDetail type="surprise_bonus_batch" />)

    expect(await screen.findByRole("heading", { name: "Surprise Bonus" })).toBeInTheDocument()
    expect(screen.getByText("Healthy")).toBeInTheDocument()
    expect(screen.getByText("surprise_bonus_batch")).toBeInTheDocument()
  })

  it("filters jobs client-side by status chip", async () => {
    mockFetchSequence([
      { json: detailResponse({ jobs: [job({ id: "job-1", status: "completed", description: "Done batch" }), job({ id: "job-2", status: "failed", description: "Broken batch", lastError: "boom" })] }) },
    ])
    render(<QueueDetail type="surprise_bonus_batch" />)

    await screen.findByText("Done batch")
    expect(screen.getByText("Broken batch")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Failed" }))

    expect(screen.queryByText("Done batch")).not.toBeInTheDocument()
    expect(screen.getByText("Broken batch")).toBeInTheDocument()
  })

  it("filters jobs client-side by search text", async () => {
    mockFetchSequence([
      { json: detailResponse({ jobs: [job({ id: "job-1", description: "Sweet December" }), job({ id: "job-2", description: "Winter Wonder" })] }) },
    ])
    render(<QueueDetail type="surprise_bonus_batch" />)
    await screen.findByText("Sweet December")

    fireEvent.change(screen.getByPlaceholderText(/Job name, id, worker/), { target: { value: "winter" } })

    expect(screen.queryByText("Sweet December")).not.toBeInTheDocument()
    expect(screen.getByText("Winter Wonder")).toBeInTheDocument()
  })

  it("shows the bulk action bar once a job is selected, and bulk Retry posts a requeue per selected job", async () => {
    mockFetchSequence([
      { json: detailResponse({ jobs: [job({ id: "job-1", status: "failed", description: "Broken batch" })] }) },
      { json: { success: true } },
      { json: detailResponse({ jobs: [] }) },
    ])
    render(<QueueDetail type="surprise_bonus_batch" />)
    await screen.findByText("Broken batch")

    expect(screen.queryByText(/selected/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Broken batch" }))

    // "1" lives inside a <strong>, so match on the full text of its parent rather than
    // a single text node (getByText only matches a node's own direct text children).
    expect(await screen.findByText((_, el) => el?.textContent === "1 job selected")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    await waitFor(() => {
      const retryCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes("/job-1/requeue"))
      expect(retryCall).toBeDefined()
      expect(retryCall![1]).toMatchObject({ method: "POST" })
    })
  })

  it("clicking delete, after confirming, calls the DELETE endpoint and reloads", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true))
    mockFetchSequence([
      { json: detailResponse({ jobs: [job({ id: "job-1", status: "completed", description: "All done" })] }) },
      { json: { success: true, id: "job-1" } },
      { json: detailResponse({ jobs: [] }) },
    ])
    render(<QueueDetail type="surprise_bonus_batch" />)
    await screen.findByText("All done")

    fireEvent.click(screen.getByTitle("Delete job"))

    await waitFor(() => {
      const deleteCall = vi.mocked(fetch).mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")
      expect(deleteCall).toBeDefined()
      expect(String(deleteCall![0])).toContain("/api/admin/queue/job-1")
    })
  })

  it("clicking a job row updates the URL's job query param (opens the drawer)", async () => {
    mockFetchSequence([
      { json: detailResponse({ jobs: [job({ id: "job-1", description: "Sweet December" })] }) },
      { json: { id: "job-1", type: "surprise_bonus_batch", label: "Surprise Bonus", status: "completed", isStale: false, attempts: 1, maxAttempts: 5, availableAt: "", lockedAt: null, lockedBy: null, lastError: null, result: null, payload: {}, createdAt: "", completedAt: null, description: null } },
    ])
    render(<QueueDetail type="surprise_bonus_batch" />)
    await screen.findByText("Sweet December")

    fireEvent.click(screen.getByTitle("Open job"))

    expect(replace).toHaveBeenCalledWith(expect.stringContaining("job=job-1"), expect.anything())
  })

  // There's no Transactions tab anymore (see docs/technical/queue-console-redesign.md,
  // "Transactions tab removed from UI") — a stale `?tab=tx` bookmark from before that
  // change should just render the Jobs view rather than error or show nothing.
  it("ignores a stale ?tab=tx query param and renders the Jobs view", async () => {
    mockSearchParams = new URLSearchParams("tab=tx")
    mockFetchSequence([{ json: detailResponse({ jobs: [job({ id: "job-1", description: "Sweet December" })] }) }])
    render(<QueueDetail type="surprise_bonus_batch" />)

    expect(await screen.findByText("Sweet December")).toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/transactions"))).toBe(false)
  })
})
