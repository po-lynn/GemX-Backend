import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"

vi.mock("next/server", () => ({ connection: vi.fn() }))

vi.mock("@/lib/api-guard", () => ({
  requireAdminOrFeature: vi.fn(),
}))

vi.mock("@/lib/queue/queue", () => ({
  requeueJob: vi.fn(),
  setJobDone: vi.fn(),
  cancelJob: vi.fn(),
}))

import { requireAdminOrFeature } from "@/lib/api-guard"
import { cancelJob, requeueJob, setJobDone } from "@/lib/queue/queue"
import { POST as requeue } from "@/app/api/admin/queue/[id]/requeue/route"
import { POST as done } from "@/app/api/admin/queue/[id]/done/route"
import { POST as cancel } from "@/app/api/admin/queue/[id]/cancel/route"

function req(path: string) {
  return new Request(`http://localhost${path}`, { method: "POST" }) as NextRequest
}
const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(connection).mockResolvedValue(undefined)
  vi.mocked(requireAdminOrFeature).mockResolvedValue({
    session: { user: { id: "admin-1", role: "admin" } },
  } as never)
})

describe("POST /api/admin/queue/[id]/requeue", () => {
  it("returns 401 when unauthorized", async () => {
    vi.mocked(requireAdminOrFeature).mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as never)

    const res = await requeue(req("/api/admin/queue/job-1/requeue"), params("job-1"))
    expect(res.status).toBe(401)
  })

  it("requeues the job and returns success", async () => {
    vi.mocked(requeueJob).mockResolvedValue(true)

    const res = await requeue(req("/api/admin/queue/job-1/requeue"), params("job-1"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, id: "job-1" })
    expect(requeueJob).toHaveBeenCalledWith("job-1")
  })

  it("returns 404 when the job doesn't exist", async () => {
    vi.mocked(requeueJob).mockResolvedValue(false)

    const res = await requeue(req("/api/admin/queue/missing/requeue"), params("missing"))
    expect(res.status).toBe(404)
  })
})

describe("POST /api/admin/queue/[id]/done", () => {
  it("returns 401 when unauthorized", async () => {
    vi.mocked(requireAdminOrFeature).mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as never)

    const res = await done(req("/api/admin/queue/job-1/done"), params("job-1"))
    expect(res.status).toBe(401)
  })

  // setJobDone deletes the job's row (same as the normal completion path),
  // so the route only needs to forward the id — no result payload to build.
  it("marks the job done and returns success", async () => {
    vi.mocked(setJobDone).mockResolvedValue(true)

    const res = await done(req("/api/admin/queue/job-1/done"), params("job-1"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, id: "job-1" })
    expect(setJobDone).toHaveBeenCalledWith("job-1")
  })

  it("returns 404 when the job doesn't exist", async () => {
    vi.mocked(setJobDone).mockResolvedValue(false)

    const res = await done(req("/api/admin/queue/missing/done"), params("missing"))
    expect(res.status).toBe(404)
  })
})

describe("POST /api/admin/queue/[id]/cancel", () => {
  it("returns 401 when unauthorized", async () => {
    vi.mocked(requireAdminOrFeature).mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as never)

    const res = await cancel(req("/api/admin/queue/job-1/cancel"), params("job-1"))
    expect(res.status).toBe(401)
  })

  it("cancels the job with an attributed reason and returns success", async () => {
    vi.mocked(cancelJob).mockResolvedValue(true)

    const res = await cancel(req("/api/admin/queue/job-1/cancel"), params("job-1"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, id: "job-1" })
    expect(cancelJob).toHaveBeenCalledWith("job-1", expect.stringContaining("admin-1"))
  })

  // Covers both "doesn't exist" and "already completed" — cancelJob's WHERE
  // clause conflates them into one boolean, matching DELETE's convention.
  it("returns 404 when the job doesn't exist or is already completed", async () => {
    vi.mocked(cancelJob).mockResolvedValue(false)

    const res = await cancel(req("/api/admin/queue/job-1/cancel"), params("job-1"))
    expect(res.status).toBe(404)
  })
})
