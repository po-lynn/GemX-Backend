import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"

vi.mock("next/server", () => ({ connection: vi.fn() }))

vi.mock("@/lib/api-guard", () => ({
  requireAdminOrFeature: vi.fn(),
}))

vi.mock("@/features/points/db/surprise-bonus", () => ({
  getSurpriseBonusJobStatusCounts: vi.fn(),
  listSurpriseBonusJobs: vi.fn(),
}))

vi.mock("@/lib/queue/drain", () => ({
  drainJobs: vi.fn(),
}))

vi.mock("@/lib/queue/registry", () => ({
  getQueueJobDefinition: vi.fn(),
}))

vi.mock("@/lib/queue/registrations", () => ({}))

import { requireAdminOrFeature } from "@/lib/api-guard"
import {
  getSurpriseBonusJobStatusCounts,
  listSurpriseBonusJobs,
} from "@/features/points/db/surprise-bonus"
import { drainJobs } from "@/lib/queue/drain"
import { getQueueJobDefinition } from "@/lib/queue/registry"
import { GET } from "@/app/api/admin/points/surprise-bonus/jobs/route"
import { POST } from "@/app/api/admin/points/surprise-bonus/jobs/retry/route"

function req(method: string, path: string) {
  return new Request(`http://localhost${path}`, { method }) as NextRequest
}

describe("GET /api/admin/points/surprise-bonus/jobs", () => {
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

    const res = await GET(req("GET", "/api/admin/points/surprise-bonus/jobs"))
    expect(res.status).toBe(401)
  })

  it("returns status counts and the recent job list, serialized as ISO dates", async () => {
    vi.mocked(getSurpriseBonusJobStatusCounts).mockResolvedValue({
      pending: 1,
      processing: 1,
      completed: 10,
      failed: 0,
      stale: 1,
    })
    const lockedAt = new Date("2026-09-08T10:00:00Z")
    vi.mocked(listSurpriseBonusJobs).mockResolvedValue([
      {
        id: "job-1",
        type: "surprise_bonus_batch",
        payload: { campaignId: "camp-1" },
        status: "processing",
        attempts: 1,
        maxAttempts: 5,
        availableAt: new Date("2026-09-08T09:59:00Z"),
        lockedAt,
        lockedBy: "local-abc123",
        lastError: null,
        createdAt: new Date("2026-09-08T09:58:00Z"),
        completedAt: null,
        campaignId: "camp-1",
        campaignName: "Sweet December",
        isStale: true,
      },
    ] as never)

    const res = await GET(req("GET", "/api/admin/points/surprise-bonus/jobs"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.counts).toEqual({ pending: 1, processing: 1, completed: 10, failed: 0, stale: 1 })
    expect(body.jobs).toEqual([
      {
        id: "job-1",
        status: "processing",
        isStale: true,
        attempts: 1,
        maxAttempts: 5,
        availableAt: "2026-09-08T09:59:00.000Z",
        lockedAt: "2026-09-08T10:00:00.000Z",
        lockedBy: "local-abc123",
        lastError: null,
        createdAt: "2026-09-08T09:58:00.000Z",
        completedAt: null,
        campaignId: "camp-1",
        campaignName: "Sweet December",
      },
    ])
  })
})

describe("POST /api/admin/points/surprise-bonus/jobs/retry", () => {
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

    const res = await POST(req("POST", "/api/admin/points/surprise-bonus/jobs/retry"))
    expect(res.status).toBe(401)
  })

  it("runs a drain pass and reports how many batches it processed", async () => {
    vi.mocked(getQueueJobDefinition).mockReturnValue({
      type: "surprise_bonus_batch",
      label: "Surprise Bonus",
      handler: vi.fn(),
    } as never)
    vi.mocked(drainJobs).mockResolvedValue({ batches: 2 })

    const res = await POST(req("POST", "/api/admin/points/surprise-bonus/jobs/retry"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, batches: 2 })
    expect(drainJobs).toHaveBeenCalledWith(
      "surprise_bonus_batch",
      expect.any(Function),
      { maxBatches: 50 },
    )
  })

  it("returns 500 with a descriptive message when the drain throws", async () => {
    vi.mocked(getQueueJobDefinition).mockReturnValue({
      type: "surprise_bonus_batch",
      label: "Surprise Bonus",
      handler: vi.fn(),
    } as never)
    vi.mocked(drainJobs).mockRejectedValue(new Error("relation missing"))

    const res = await POST(req("POST", "/api/admin/points/surprise-bonus/jobs/retry"))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Retry failed: relation missing")
  })
})
