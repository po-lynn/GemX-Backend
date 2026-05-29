import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET } from "@/app/api/mobile/points/purchase-history/route"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/drizzle/schema/points-schema", () => ({
  pointPurchaseRequest: {
    id: "id",
    userId: "user_id",
    packageName: "package_name",
    points: "points",
    price: "price",
    currency: "currency",
    status: "status",
    transferredAmount: "transferred_amount",
    transferredName: "transferred_name",
    transactionReference: "transaction_reference",
    transferNote: "transfer_note",
    adminNote: "admin_note",
    createdAt: "created_at",
    reviewedAt: "reviewed_at",
  },
}))
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  desc: vi.fn((col: unknown) => ({ type: "desc", col })),
  eq: vi.fn((col: unknown, val: unknown) => ({ type: "eq", col, val })),
}))
vi.mock("@/drizzle/db", () => ({
  db: { select: vi.fn() },
}))

function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  for (const m of ["from", "where", "orderBy"]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject)
  chain.catch = (reject: (e: unknown) => unknown) => Promise.resolve(rows).catch(reject)
  return chain
}

const SESSION = { user: { id: "user-abc" } }

describe("GET /api/mobile/points/purchase-history", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })

  it("returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/api/mobile/points/purchase-history") as NextRequest
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns approved purchase history for the session user", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const reviewed = new Date("2024-06-01T12:00:00.000Z")
    const created = new Date("2024-06-01T10:00:00.000Z")
    vi.mocked(db.select).mockReturnValueOnce(
      selectChain([
        {
          id: "req-1",
          packageName: "Starter Pack",
          points: 100,
          price: 5000,
          currency: "mmk",
          status: "approved",
          transferredAmount: 5000,
          transferredName: "Ko Aung",
          transactionReference: "TXN-1",
          transferNote: null,
          adminNote: "OK",
          createdAt: created,
          reviewedAt: reviewed,
        },
      ]) as never
    )

    const req = new Request("http://localhost/api/mobile/points/purchase-history") as NextRequest
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      history: Array<{
        id: string
        package_name: string
        status: string
        points: number
        createdAt: string
        reviewedAt: string | null
      }>
    }
    expect(body.history).toHaveLength(1)
    expect(body.history[0].package_name).toBe("Starter Pack")
    expect(body.history[0].status).toBe("approved")
    expect(body.history[0].points).toBe(100)
    expect(body.history[0].createdAt).toBe(created.toISOString())
    expect(body.history[0].reviewedAt).toBe(reviewed.toISOString())
  })
})
