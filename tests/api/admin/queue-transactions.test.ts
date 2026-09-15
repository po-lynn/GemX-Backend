import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"

vi.mock("next/server", () => ({ connection: vi.fn() }))

vi.mock("@/lib/api-guard", () => ({
  requireAdminOrFeature: vi.fn(),
}))

vi.mock("@/lib/queue/registry", () => ({
  getQueueJobDefinition: vi.fn(),
}))

vi.mock("@/lib/queue/registrations", () => ({}))

import { requireAdminOrFeature } from "@/lib/api-guard"
import { getQueueJobDefinition } from "@/lib/queue/registry"
import { GET } from "@/app/api/admin/queue/transactions/route"

function req(path: string) {
  return new Request(`http://localhost${path}`) as NextRequest
}

describe("GET /api/admin/queue/transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(requireAdminOrFeature).mockResolvedValue({
      session: { user: { id: "admin-1", role: "admin" } },
    } as never)
  })

  // Auth is gated the same way as the rest of /api/admin/queue/*.
  it("returns 401 when unauthorized", async () => {
    vi.mocked(requireAdminOrFeature).mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as never)

    const res = await GET(req("/api/admin/queue/transactions?type=surprise_bonus_batch"))
    expect(res.status).toBe(401)
  })

  // type is required so the route always knows which registration to consult.
  it("returns 400 when type is missing", async () => {
    const res = await GET(req("/api/admin/queue/transactions"))
    expect(res.status).toBe(400)
  })

  it("returns 404 for an unknown type", async () => {
    vi.mocked(getQueueJobDefinition).mockReturnValue(undefined)
    const res = await GET(req("/api/admin/queue/transactions?type=unknown_type"))
    expect(res.status).toBe(404)
  })

  // A job type registered without a listTransactions hook degrades gracefully
  // instead of erroring, so the client can fall back to the Jobs view.
  it("reports supported: false for a job type with no listTransactions hook", async () => {
    vi.mocked(getQueueJobDefinition).mockReturnValue({
      type: "other_type",
      label: "Other",
      handler: vi.fn(),
    })

    const res = await GET(req("/api/admin/queue/transactions?type=other_type"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ supported: false, transactions: [] })
  })

  it("returns transactions serialized with ISO date strings, capped at the requested limit", async () => {
    const listTransactions = vi.fn().mockResolvedValue([
      {
        id: "tx-1",
        source: "transaction",
        description: "Jane Doe (jane@example.com)",
        state: "completed",
        createdAt: new Date("2026-09-14T09:00:00Z"),
        completedAt: new Date("2026-09-14T09:00:00Z"),
        reference: "campaign-1",
        detail: "+500 pts",
      },
      {
        id: "job-1",
        source: "job",
        description: "Credit batch — NYC200",
        state: "pending",
        createdAt: new Date("2026-09-14T21:02:00Z"),
        completedAt: null,
        reference: "campaign-1",
        detail: "0/5 attempts",
      },
    ])
    vi.mocked(getQueueJobDefinition).mockReturnValue({
      type: "surprise_bonus_batch",
      label: "Surprise Bonus",
      handler: vi.fn(),
      listTransactions,
    })

    const res = await GET(req("/api/admin/queue/transactions?type=surprise_bonus_batch&limit=10"))
    expect(res.status).toBe(200)
    expect(listTransactions).toHaveBeenCalledWith(10)
    const body = await res.json()
    expect(body).toEqual({
      supported: true,
      transactions: [
        {
          id: "tx-1", source: "transaction", description: "Jane Doe (jane@example.com)", state: "completed",
          createdAt: "2026-09-14T09:00:00.000Z", completedAt: "2026-09-14T09:00:00.000Z",
          reference: "campaign-1", detail: "+500 pts",
        },
        {
          id: "job-1", source: "job", description: "Credit batch — NYC200", state: "pending",
          createdAt: "2026-09-14T21:02:00.000Z", completedAt: null,
          reference: "campaign-1", detail: "0/5 attempts",
        },
      ],
    })
  })

  // A caller-supplied limit above MAX_LIMIT (500) is clamped, not passed through raw.
  it("clamps an oversized limit to the maximum", async () => {
    const listTransactions = vi.fn().mockResolvedValue([])
    vi.mocked(getQueueJobDefinition).mockReturnValue({
      type: "surprise_bonus_batch",
      label: "Surprise Bonus",
      handler: vi.fn(),
      listTransactions,
    })

    await GET(req("/api/admin/queue/transactions?type=surprise_bonus_batch&limit=99999"))
    expect(listTransactions).toHaveBeenCalledWith(500)
  })

  // A fractional limit (e.g. from a hand-edited URL) must not reach Drizzle's
  // .limit(), which expects an integer — falls back to the default instead.
  it("falls back to the default limit when given a non-integer value", async () => {
    const listTransactions = vi.fn().mockResolvedValue([])
    vi.mocked(getQueueJobDefinition).mockReturnValue({
      type: "surprise_bonus_batch",
      label: "Surprise Bonus",
      handler: vi.fn(),
      listTransactions,
    })

    await GET(req("/api/admin/queue/transactions?type=surprise_bonus_batch&limit=1.5"))
    expect(listTransactions).toHaveBeenCalledWith(200)
  })

  // No limit param at all falls back to the default rather than NaN/0.
  it("defaults the limit when none is given", async () => {
    const listTransactions = vi.fn().mockResolvedValue([])
    vi.mocked(getQueueJobDefinition).mockReturnValue({
      type: "surprise_bonus_batch",
      label: "Surprise Bonus",
      handler: vi.fn(),
      listTransactions,
    })

    await GET(req("/api/admin/queue/transactions?type=surprise_bonus_batch"))
    expect(listTransactions).toHaveBeenCalledWith(200)
  })
})
