import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"

vi.mock("next/server", () => ({ connection: vi.fn() }))

vi.mock("@/lib/api-guard", () => ({
  requireAdminOrFeature: vi.fn(),
}))

vi.mock("@/lib/queue/queue", () => ({
  getJobStatusCounts: vi.fn(),
  listJobs: vi.fn(),
}))

vi.mock("@/lib/queue/drain", () => ({
  drainJobs: vi.fn(),
}))

vi.mock("@/lib/queue/registry", () => ({
  listRegisteredJobTypes: vi.fn(),
  getQueueJobDefinition: vi.fn(),
}))

vi.mock("@/lib/queue/registrations", () => ({}))

import { requireAdminOrFeature } from "@/lib/api-guard"
import { getJobStatusCounts, listJobs } from "@/lib/queue/queue"
import { drainJobs } from "@/lib/queue/drain"
import { getQueueJobDefinition, listRegisteredJobTypes } from "@/lib/queue/registry"
import { GET } from "@/app/api/admin/queue/route"
import { POST } from "@/app/api/admin/queue/retry/route"

function req(method: string, path: string, body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }) as NextRequest
}

describe("GET /api/admin/queue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(requireAdminOrFeature).mockResolvedValue({
      session: { user: { id: "admin-1", role: "admin" } },
    } as never)
  })

  it("returns 401 when unauthorized", async () => {
    vi.mocked(requireAdminOrFeature).mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as never)

    const res = await GET(req("GET", "/api/admin/queue"))
    expect(res.status).toBe(401)
  })

  it("without a type: returns status counts for every registered type", async () => {
    vi.mocked(listRegisteredJobTypes).mockReturnValue([{ type: "surprise_bonus_batch", label: "Surprise Bonus" }])
    vi.mocked(getJobStatusCounts).mockResolvedValue({ pending: 1, processing: 0, completed: 5, failed: 0, stale: 0 })

    const res = await GET(req("GET", "/api/admin/queue"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      types: [
        {
          type: "surprise_bonus_batch",
          label: "Surprise Bonus",
          counts: { pending: 1, processing: 0, completed: 5, failed: 0, stale: 0 },
        },
      ],
    })
  })

  it("returns 404 for an unknown type", async () => {
    vi.mocked(listRegisteredJobTypes).mockReturnValue([])
    vi.mocked(getQueueJobDefinition).mockReturnValue(undefined)

    const res = await GET(req("GET", "/api/admin/queue?type=unknown_type"))
    expect(res.status).toBe(404)
  })

  it("with a type: returns counts, jobs, and description text from describeJobs", async () => {
    vi.mocked(listRegisteredJobTypes).mockReturnValue([{ type: "surprise_bonus_batch", label: "Surprise Bonus" }])
    vi.mocked(getQueueJobDefinition).mockReturnValue({
      type: "surprise_bonus_batch",
      label: "Surprise Bonus",
      handler: vi.fn(),
      describeJobs: vi.fn().mockResolvedValue(new Map([["job-1", "Sweet December"]])),
    })
    vi.mocked(getJobStatusCounts).mockResolvedValue({ pending: 0, processing: 1, completed: 0, failed: 0, stale: 0 })
    const lockedAt = new Date("2026-09-08T10:00:00Z")
    vi.mocked(listJobs).mockResolvedValue([
      {
        id: "job-1", type: "surprise_bonus_batch", payload: {}, status: "processing",
        attempts: 1, maxAttempts: 5, availableAt: new Date("2026-09-08T09:59:00Z"),
        lockedAt, lockedBy: "local-abc123", lastError: null,
        createdAt: new Date("2026-09-08T09:58:00Z"), completedAt: null, isStale: true,
      },
    ])

    const res = await GET(req("GET", "/api/admin/queue?type=surprise_bonus_batch"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.selectedType).toBe("surprise_bonus_batch")
    expect(body.counts).toEqual({ pending: 0, processing: 1, completed: 0, failed: 0, stale: 0 })
    expect(body.jobs).toEqual([
      {
        id: "job-1", status: "processing", isStale: true, attempts: 1, maxAttempts: 5,
        availableAt: "2026-09-08T09:59:00.000Z", lockedAt: "2026-09-08T10:00:00.000Z",
        lockedBy: "local-abc123", lastError: null,
        createdAt: "2026-09-08T09:58:00.000Z", completedAt: null, description: "Sweet December",
      },
    ])
  })
})

describe("POST /api/admin/queue/retry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(requireAdminOrFeature).mockResolvedValue({
      session: { user: { id: "admin-1", role: "admin" } },
    } as never)
  })

  it("returns 401 when unauthorized", async () => {
    vi.mocked(requireAdminOrFeature).mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as never)

    const res = await POST(req("POST", "/api/admin/queue/retry", { type: "surprise_bonus_batch" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 when type is missing", async () => {
    const res = await POST(req("POST", "/api/admin/queue/retry", {}))
    expect(res.status).toBe(400)
  })

  it("returns 404 for an unknown type", async () => {
    vi.mocked(getQueueJobDefinition).mockReturnValue(undefined)
    const res = await POST(req("POST", "/api/admin/queue/retry", { type: "unknown_type" }))
    expect(res.status).toBe(404)
  })

  it("runs a drain pass and reports how many batches it processed", async () => {
    const handler = vi.fn()
    vi.mocked(getQueueJobDefinition).mockReturnValue({ type: "surprise_bonus_batch", label: "Surprise Bonus", handler })
    vi.mocked(drainJobs).mockResolvedValue({ batches: 2 })

    const res = await POST(req("POST", "/api/admin/queue/retry", { type: "surprise_bonus_batch" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, batches: 2 })
    expect(drainJobs).toHaveBeenCalledWith("surprise_bonus_batch", handler, { maxBatches: 50 })
  })

  it("returns 500 with a descriptive message when the drain throws", async () => {
    vi.mocked(getQueueJobDefinition).mockReturnValue({ type: "surprise_bonus_batch", label: "Surprise Bonus", handler: vi.fn() })
    vi.mocked(drainJobs).mockRejectedValue(new Error("relation missing"))

    const res = await POST(req("POST", "/api/admin/queue/retry", { type: "surprise_bonus_batch" }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Retry failed: relation missing")
  })
})
