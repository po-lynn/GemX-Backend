import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET } from "@/app/api/mobile/points/history/route"
import { getUserPointBalance, getUserPointHistory } from "@/features/points/db/points"
import { auth } from "@/lib/auth"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/points/db/points", () => ({
  getUserPointBalance: vi.fn(),
  getUserPointHistory: vi.fn(),
}))

const SESSION = { user: { id: "user-abc" } }

describe("GET /api/mobile/points/history", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    vi.mocked(getUserPointBalance).mockResolvedValue({
      available: 100,
      reserved: 0,
      lifetime: 100,
    })
    vi.mocked(getUserPointHistory).mockResolvedValue({ transactions: [], total: 0 })
  })

  it("returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/api/mobile/points/history") as NextRequest
    const res = await GET(req)
    expect(res.status).toBe(401)
    expect(getUserPointBalance).not.toHaveBeenCalled()
    expect(getUserPointHistory).not.toHaveBeenCalled()
  })

  it("returns 400 for invalid query params", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const req = new Request(
      "http://localhost/api/mobile/points/history?filter=bogus"
    ) as NextRequest
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it("returns balance, transactions, and pagination for an authenticated user", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const createdAt = new Date("2024-06-01T10:00:00.000Z")
    vi.mocked(getUserPointHistory).mockResolvedValue({
      transactions: [
        {
          id: "tx-1",
          type: "topup",
          direction: "credit",
          amount: 100,
          status: "completed",
          description: "Top up",
          paymentMethod: "KBZ Pay",
          referenceId: null,
          referenceType: null,
          createdAt,
        },
      ] as never,
      total: 1,
    })

    const req = new Request(
      "http://localhost/api/mobile/points/history?filter=topups&page=1&limit=20"
    ) as NextRequest
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      balance: { available: number }
      transactions: Array<{ id: string; createdAt: string }>
      pagination: { total: number; page: number; limit: number }
    }
    expect(body.balance.available).toBe(100)
    expect(body.transactions).toHaveLength(1)
    expect(body.transactions[0].createdAt).toBe(createdAt.toISOString())
    expect(body.pagination).toEqual({ total: 1, page: 1, limit: 20 })
    expect(getUserPointHistory).toHaveBeenCalledWith("user-abc", {
      filter: "topups",
      page: 1,
      limit: 20,
    })
  })

  // Balance and history are fetched sequentially (not Promise.all) so the route never holds
  // two pooler connections at once for a single request — assert call ordering, not just
  // that both were eventually called.
  it("fetches balance before transaction history (sequential, not concurrent)", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const callOrder: string[] = []
    vi.mocked(getUserPointBalance).mockImplementation(async () => {
      callOrder.push("balance")
      return { available: 100, reserved: 0, lifetime: 100 }
    })
    vi.mocked(getUserPointHistory).mockImplementation(async () => {
      callOrder.push("history")
      return { transactions: [], total: 0 }
    })

    const req = new Request("http://localhost/api/mobile/points/history") as NextRequest
    await GET(req)
    expect(callOrder).toEqual(["balance", "history"])
  })

  it("returns 503 with Retry-After when the balance query hangs past the timeout", async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
      vi.mocked(getUserPointBalance).mockReturnValue(new Promise(() => {}))
      const req = new Request("http://localhost/api/mobile/points/history") as NextRequest
      const resPromise = GET(req)
      await vi.advanceTimersByTimeAsync(6000)
      const res = await resPromise
      expect(res.status).toBe(503)
      expect(res.headers.get("Retry-After")).toBe("3")
      const data = await res.json()
      expect(data.error).toMatch(/retry/i)
      expect(getUserPointHistory).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it("returns 503 with Retry-After when the transaction history query hangs past the timeout", async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
      vi.mocked(getUserPointHistory).mockReturnValue(new Promise(() => {}))
      const req = new Request("http://localhost/api/mobile/points/history") as NextRequest
      const resPromise = GET(req)
      await vi.advanceTimersByTimeAsync(6000)
      const res = await resPromise
      expect(res.status).toBe(503)
      expect(res.headers.get("Retry-After")).toBe("3")
      const data = await res.json()
      expect(data.error).toMatch(/retry/i)
    } finally {
      vi.useRealTimers()
    }
  })

  it("returns 500 when getUserPointHistory throws a non-timeout error", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(getUserPointHistory).mockRejectedValue(new Error("DB error"))
    const req = new Request("http://localhost/api/mobile/points/history") as NextRequest
    const res = await GET(req)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toHaveProperty("error", "Failed to load point history")
  })
})
