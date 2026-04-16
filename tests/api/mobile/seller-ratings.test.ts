import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET as GETMine, POST } from "@/app/api/mobile/seller-ratings/route"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/users/db/users", () => ({
  getUserById: vi.fn(),
}))
vi.mock("@/drizzle/schema/seller-rating-schema", () => ({
  sellerRating: {
    id: "id",
    raterUserId: "rater_user_id",
    sellerUserId: "seller_user_id",
    score: "score",
    comment: "comment",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
}))
vi.mock("@/drizzle/schema/auth-schema", () => ({
  user: { id: "id", name: "name", image: "image", username: "username", displayUsername: "display_username" },
}))
vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn((_col, val) => `eq:${val}`),
  sql: vi.fn(),
}))
vi.mock("@/drizzle/db", () => ({
  db: { select: vi.fn(), insert: vi.fn() },
}))

function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  for (const m of ["from", "where", "limit", "offset", "orderBy", "innerJoin"]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject)
  chain.catch = (reject: (e: unknown) => unknown) => Promise.resolve(rows).catch(reject)
  return chain
}

function insertChain(rows: unknown[]) {
  const returning = {
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
    catch: (reject: (e: unknown) => unknown) => Promise.resolve(rows).catch(reject),
  }
  return {
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue(returning),
      }),
    }),
  }
}

const SESSION = { user: { id: "rater-1" } }
const SELLER_ID = "seller-1"

describe("mobile seller ratings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })

  it("POST returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/api/mobile/seller-ratings", {
      method: "POST",
      body: JSON.stringify({ sellerId: SELLER_ID, score: 5 }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(401)
  })

  it("POST returns 400 when rating self", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: SELLER_ID } } as never)
    const { getUserById } = await import("@/features/users/db/users")
    vi.mocked(getUserById).mockResolvedValue({
      id: SELLER_ID,
      archived: false,
    } as never)
    const req = new Request("http://localhost/api/mobile/seller-ratings", {
      method: "POST",
      body: JSON.stringify({ sellerId: SELLER_ID, score: 5 }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "Cannot rate yourself" })
  })

  it("POST returns 200 when rating is saved", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const { getUserById } = await import("@/features/users/db/users")
    vi.mocked(getUserById).mockResolvedValue({
      id: SELLER_ID,
      archived: false,
    } as never)
    vi.mocked(db.insert).mockReturnValueOnce(
      insertChain([
        {
          id: "rating-1",
          createdAt: new Date("2026-04-16T00:00:00.000Z"),
          updatedAt: new Date("2026-04-16T00:00:00.000Z"),
        },
      ]) as never
    )
    const req = new Request("http://localhost/api/mobile/seller-ratings", {
      method: "POST",
      body: JSON.stringify({ sellerId: SELLER_ID, score: 4, comment: "Good seller" }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      success: true,
      rating: { id: "rating-1", sellerId: SELLER_ID, score: 4, comment: "Good seller" },
    })
  })

  it("GET mine returns paginated list", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const now = new Date("2026-04-16T00:00:00.000Z")
    vi.mocked(db.select)
      .mockReturnValueOnce(
        selectChain([
          {
            id: "rating-1",
            sellerUserId: SELLER_ID,
            score: 5,
            comment: null,
            createdAt: now,
            updatedAt: now,
            sellerName: "Seller",
            sellerImage: null,
            sellerUsername: "s1",
            sellerDisplayUsername: "Seller",
          },
        ]) as never
      )
      .mockReturnValueOnce(selectChain([{ count: 1 }]) as never)

    const req = new Request("http://localhost/api/mobile/seller-ratings?page=1&limit=10")
    const res = await GETMine(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ total: 1, page: 1, limit: 10 })
    expect(body.ratings[0]).toMatchObject({
      sellerId: SELLER_ID,
      score: 5,
      seller: { name: "Seller" },
    })
  })

})
