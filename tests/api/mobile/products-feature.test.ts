import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { POST } from "@/app/api/mobile/products/[id]/feature/route"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"
import {
  getFeatureSettings,
  getUserPointBalance,
  logPointTransaction,
} from "@/features/points/db/points"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/points/db/points", () => ({
  getFeatureSettings: vi.fn(),
  getUserPointBalance: vi.fn(),
  logPointTransaction: vi.fn(),
}))
vi.mock("@/features/products/db/cache/products", () => ({
  revalidateProductsCache: vi.fn(),
}))
vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
}))

const SESSION = { user: { id: "seller-1" } }
const PRODUCT_ID = "prod-11111111-1111-1111-1111-111111111111"
const TIER = { durationDays: 7, points: 500 }

function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  for (const m of ["from", "where", "limit"]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject)
  chain.catch = (reject: (e: unknown) => unknown) => Promise.resolve(rows).catch(reject)
  return chain
}

describe("POST /api/mobile/products/:id/feature", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    vi.mocked(getFeatureSettings).mockResolvedValue({
      homeFeaturedLimit: 5,
      pricingTiers: [TIER],
    })
    vi.mocked(getUserPointBalance).mockResolvedValue({
      available: 1000,
      reserved: 0,
      lifetime: 1000,
    })
    vi.mocked(logPointTransaction).mockResolvedValue({ id: "tx-1" })
  })

  it("returns 401 when unauthenticated", async () => {
    const req = new Request(`http://localhost/api/mobile/products/${PRODUCT_ID}/feature`, {
      method: "POST",
      body: JSON.stringify({ durationDays: 7, points: 500 }),
    })
    const res = await POST(req as NextRequest, {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })
    expect(res.status).toBe(401)
  })

  it("returns 400 when available points are below tier cost before featuring", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(getUserPointBalance).mockResolvedValue({
      available: 100,
      reserved: 0,
      lifetime: 500,
    })
    vi.mocked(db.select).mockReturnValueOnce(
      selectChain([{ id: PRODUCT_ID, sellerId: SESSION.user.id }]) as never
    )

    const req = new Request(`http://localhost/api/mobile/products/${PRODUCT_ID}/feature`, {
      method: "POST",
      body: JSON.stringify({ durationDays: 7, points: 500 }),
    })
    const res = await POST(req as NextRequest, {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "Insufficient points balance" })
    expect(db.transaction).not.toHaveBeenCalled()
    expect(logPointTransaction).not.toHaveBeenCalled()
  })

  it("returns 400 when atomic deduction fails and does not feature the product", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(db.select)
      .mockReturnValueOnce(
        selectChain([{ id: PRODUCT_ID, sellerId: SESSION.user.id }]) as never
      )
      .mockReturnValueOnce(selectChain([{ count: 0 }]) as never)
    vi.mocked(db.transaction).mockImplementation(async (fn) =>
      (fn as (tx: unknown) => Promise<unknown>)({
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      })
    )

    const req = new Request(`http://localhost/api/mobile/products/${PRODUCT_ID}/feature`, {
      method: "POST",
      body: JSON.stringify({ durationDays: 7, points: 500 }),
    })
    const res = await POST(req as NextRequest, {
      params: Promise.resolve({ id: PRODUCT_ID }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "Insufficient points balance" })
    expect(logPointTransaction).not.toHaveBeenCalled()
  })
})
