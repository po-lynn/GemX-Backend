import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { DELETE, GET, POST } from "@/app/api/mobile/favourite-products/route"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/drizzle/schema/user-favourite-product-schema", () => ({
  userFavouriteProduct: {
    id: "id",
    userId: "user_id",
    productId: "product_id",
    createdAt: "created_at",
  },
}))
vi.mock("@/drizzle/schema/product-schema", () => ({
  product: {
    id: "id",
    title: "title",
    price: "price",
    currency: "currency",
    status: "status",
    isCollectorPiece: "is_collector_piece",
    isPrivilegeAssist: "is_privilege_assist",
    isPromotion: "is_promotion",
    isFeatured: "is_featured",
    sellerId: "seller_id",
  },
  productImage: {
    productId: "product_id",
    url: "url",
    sortOrder: "sort_order",
  },
}))
vi.mock("@/drizzle/schema/auth-schema", () => ({
  user: { id: "id", name: "name" },
}))
vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn((_col, val) => `eq:${val}`),
  inArray: vi.fn(() => "in-array"),
  sql: vi.fn(),
}))
vi.mock("@/drizzle/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), delete: vi.fn() },
}))

function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  for (const m of [
    "from",
    "where",
    "limit",
    "offset",
    "orderBy",
    "innerJoin",
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject)
  chain.catch = (reject: (e: unknown) => unknown) => Promise.resolve(rows).catch(reject)
  return chain
}

function insertChain() {
  const chain = {
    onConflictDoNothing: vi.fn().mockReturnValue(undefined),
  }
  return {
    values: vi.fn().mockReturnValue(chain),
  }
}

function deleteChain(rows: unknown[]) {
  const returning = {
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
    catch: (reject: (e: unknown) => unknown) => Promise.resolve(rows).catch(reject),
  }
  return {
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockReturnValue(returning),
    }),
  }
}

const SESSION = { user: { id: "user-abc" } }
const PRODUCT_ID = "00000000-0000-4000-8000-000000000001"

describe("mobile favourite products", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })

  it("POST returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/api/mobile/favourite-products", {
      method: "POST",
      body: JSON.stringify({ productId: PRODUCT_ID }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(401)
  })

  it("POST returns 404 when product does not exist", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never)
    const req = new Request("http://localhost/api/mobile/favourite-products", {
      method: "POST",
      body: JSON.stringify({ productId: PRODUCT_ID }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: "Product not found" })
  })

  it("POST returns 200 and saves favourite", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(db.select).mockReturnValueOnce(selectChain([{ id: PRODUCT_ID }]) as never)
    const insertMock = insertChain()
    vi.mocked(db.insert).mockReturnValueOnce(insertMock as never)
    const req = new Request("http://localhost/api/mobile/favourite-products", {
      method: "POST",
      body: JSON.stringify({ productId: PRODUCT_ID }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, productId: PRODUCT_ID })
  })

  it("GET returns list with pagination", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const now = new Date("2026-01-01T00:00:00.000Z")
    vi.mocked(db.select)
      .mockReturnValueOnce(
        selectChain([
          {
            favouriteId: "fav-1",
            productId: PRODUCT_ID,
            title: "Ruby Ring",
            price: "1000",
            currency: "USD",
            status: "active",
            isCollectorPiece: false,
            isPrivilegeAssist: false,
            isPromotion: false,
            isFeatured: false,
            sellerId: "seller-1",
            sellerName: "Seller A",
            createdAt: now,
          },
        ]) as never
      )
      .mockReturnValueOnce(selectChain([{ count: 1 }]) as never)
      .mockReturnValueOnce(
        selectChain([{ productId: PRODUCT_ID, url: "https://img", sortOrder: 0 }]) as never
      )

    const req = new Request("http://localhost/api/mobile/favourite-products?page=1&limit=10")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ total: 1, page: 1, limit: 10 })
    expect(body.favourites[0]).toMatchObject({
      id: "fav-1",
      productId: PRODUCT_ID,
      product: { title: "Ruby Ring", imageUrl: "https://img" },
    })
  })

  it("DELETE returns removed true when row exists", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(db.delete).mockReturnValueOnce(deleteChain([{ id: "fav-1" }]) as never)
    const req = new Request("http://localhost/api/mobile/favourite-products", {
      method: "DELETE",
      body: JSON.stringify({ productId: PRODUCT_ID }),
    })
    const res = await DELETE(req as NextRequest)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      success: true,
      productId: PRODUCT_ID,
      removed: true,
    })
  })
})
