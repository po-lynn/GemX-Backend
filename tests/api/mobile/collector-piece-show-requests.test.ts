import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { auth } from "@/lib/auth"
import { getMyCollectorPieceShowRequestsPaginated } from "@/features/collector-piece-show-requests/db/collector-piece-show-requests"
import { GET } from "@/app/api/mobile/collector-piece-show-requests/route"

vi.mock("next/server", () => ({
  connection: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/collector-piece-show-requests/db/collector-piece-show-requests", () => ({
  getMyCollectorPieceShowRequestsPaginated: vi.fn(),
}))

describe("GET /api/mobile/collector-piece-show-requests", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1" },
    } as never)
  })

  it("returns requests with productName and sellerName from the db helper", async () => {
    vi.mocked(getMyCollectorPieceShowRequestsPaginated).mockResolvedValue({
      requests: [
        {
          id: "req-1",
          productId: "prod-1",
          productName: "Collector Ruby",
          sellerName: "Jane Seller",
          status: "pending",
          message: null,
          createdAt: new Date("2026-04-14T10:00:00.000Z"),
        },
      ],
      total: 1,
    })
    const req = new Request(
      "http://localhost/api/mobile/collector-piece-show-requests?page=1&limit=10"
    )
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.requests[0].productName).toBe("Collector Ruby")
    expect(data.requests[0].sellerName).toBe("Jane Seller")
    expect(getMyCollectorPieceShowRequestsPaginated).toHaveBeenCalledWith({
      userId: "user-1",
      page: 1,
      limit: 10,
    })
  })

  it("returns 401 when session is missing", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    const req = new Request("http://localhost/api/mobile/collector-piece-show-requests")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(401)
  })
})
