import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { POST, GET } from "@/app/api/mobile/escrow-service-requests/route"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/drizzle/schema/escrow-service-request-schema", () => ({
  escrowServiceRequest: { id: "id", createdAt: "created_at" },
}))
vi.mock("@/drizzle/schema/product-schema", () => ({
  product: { id: "id", sellerId: "seller_id", title: "title" },
}))
vi.mock("@/drizzle/schema/auth-schema", () => ({
  user: { id: "id" },
}))
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => `eq:${val}`),
  desc: vi.fn(),
  sql: vi.fn(),
  and: vi.fn(),
}))
vi.mock("@/drizzle/db", () => ({
  db: { select: vi.fn(), insert: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a thenable Drizzle-like query chain that resolves to `rows`. */
function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  for (const m of ["from", "where", "limit", "offset", "leftJoin", "innerJoin", "orderBy"]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject)
  chain.catch = (reject: (e: unknown) => unknown) => Promise.resolve(rows).catch(reject)
  return chain
}

/** Build a thenable Drizzle-like insert chain whose `.returning()` resolves to `rows`. */
function insertChain(rows: unknown[]) {
  const returning = {
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
    catch: (reject: (e: unknown) => unknown) => Promise.resolve(rows).catch(reject),
  }
  return {
    values: vi.fn().mockReturnValue({ returning: vi.fn().mockReturnValue(returning) }),
  }
}

const SESSION = { user: { id: "user-abc" } }
const PRODUCT_ID = "00000000-0000-4000-8000-000000000001"
const SELLER_ID = "seller-000-0000-0000-000000000001"

// ---------------------------------------------------------------------------
// POST /api/mobile/escrow-service-requests
// ---------------------------------------------------------------------------

describe("POST /api/mobile/escrow-service-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })

  it("returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/api/mobile/escrow-service-requests", {
      method: "POST",
      body: JSON.stringify({ type: "buyer" }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: "Unauthorized" })
  })

  it("returns 400 when type is missing", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const req = new Request("http://localhost/api/mobile/escrow-service-requests", {
      method: "POST",
      body: JSON.stringify({ message: "hello" }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "Invalid input" })
  })

  it("returns 400 when type is invalid", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const req = new Request("http://localhost/api/mobile/escrow-service-requests", {
      method: "POST",
      body: JSON.stringify({ type: "admin" }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "Invalid input" })
  })

  it("returns 400 when productId is not a valid UUID", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const req = new Request("http://localhost/api/mobile/escrow-service-requests", {
      method: "POST",
      body: JSON.stringify({ type: "buyer", productId: "not-a-uuid" }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "Invalid input" })
  })

  it("returns 400 when buyer submits request for their own product (self-escrow)", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    // product's sellerId matches the session user
    vi.mocked(db.select).mockReturnValueOnce(
      selectChain([{ sellerId: SESSION.user.id }]) as never,
    )

    const req = new Request("http://localhost/api/mobile/escrow-service-requests", {
      method: "POST",
      body: JSON.stringify({ type: "buyer", productId: PRODUCT_ID }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: "Cannot request escrow for your own product",
    })
  })

  it("returns 404 when productId refers to a non-existent product", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    // product lookup returns empty array → not found
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never)

    const req = new Request("http://localhost/api/mobile/escrow-service-requests", {
      method: "POST",
      body: JSON.stringify({ type: "buyer", productId: PRODUCT_ID }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: "Product not found" })
  })

  it("returns 200 and requestId without productId (no product lookup)", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(db.insert).mockReturnValueOnce(
      insertChain([{ id: "req-001", createdAt: new Date("2026-01-01") }]) as never,
    )

    const req = new Request("http://localhost/api/mobile/escrow-service-requests", {
      method: "POST",
      body: JSON.stringify({ type: "seller", message: "I have a sapphire to sell" }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, requestId: "req-001" })
    expect(db.select).not.toHaveBeenCalled()
  })

  it("returns 200, stores sellerId from the product when productId provided", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    // product lookup → returns seller
    vi.mocked(db.select).mockReturnValueOnce(
      selectChain([{ sellerId: SELLER_ID }]) as never,
    )
    const insertMock = insertChain([{ id: "req-002", createdAt: new Date("2026-01-01") }])
    vi.mocked(db.insert).mockReturnValueOnce(insertMock as never)

    const req = new Request("http://localhost/api/mobile/escrow-service-requests", {
      method: "POST",
      body: JSON.stringify({ type: "buyer", productId: PRODUCT_ID, message: "Interested" }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, requestId: "req-002" })
    // values() should have been called with the correct sellerId
    const valuesSpy = insertMock.values as ReturnType<typeof vi.fn>
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: SESSION.user.id,
        type: "buyer",
        productId: PRODUCT_ID,
        sellerId: SELLER_ID,
      }),
    )
  })

  it("returns 500 when DB insert fails", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(db.insert).mockImplementationOnce(() => {
      throw new Error("DB error")
    })

    const req = new Request("http://localhost/api/mobile/escrow-service-requests", {
      method: "POST",
      body: JSON.stringify({ type: "buyer" }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: "Failed to submit escrow service request" })
  })

  it("returns 500 when DB insert returns empty (row not saved)", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(db.insert).mockReturnValueOnce(insertChain([]) as never)

    const req = new Request("http://localhost/api/mobile/escrow-service-requests", {
      method: "POST",
      body: JSON.stringify({ type: "seller" }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: "Failed to save request" })
  })
})

// ---------------------------------------------------------------------------
// GET /api/mobile/escrow-service-requests
// ---------------------------------------------------------------------------

describe("GET /api/mobile/escrow-service-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })

  it("returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/api/mobile/escrow-service-requests")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: "Unauthorized" })
  })

  it("returns 200 with paginated requests and total", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const now = new Date("2026-01-01T10:00:00Z")
    const fakeRows = [
      {
        id: "req-001",
        type: "buyer",
        productId: PRODUCT_ID,
        packageName: null,
        message: "Test",
        status: "pending",
        createdAt: now,
        updatedAt: now,
        productTitle: "Ruby Ring",
      },
    ]
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain(fakeRows) as never)   // rows query
      .mockReturnValueOnce(selectChain([{ count: 1 }]) as never) // count query

    const req = new Request("http://localhost/api/mobile/escrow-service-requests")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ total: 1, page: 1 })
    expect(body.requests).toHaveLength(1)
    expect(body.requests[0]).toMatchObject({
      id: "req-001",
      type: "buyer",
      status: "pending",
      product: { title: "Ruby Ring" },
    })
  })

  it("returns 200 with empty list when user has no requests", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([]) as never)
      .mockReturnValueOnce(selectChain([{ count: 0 }]) as never)

    const req = new Request("http://localhost/api/mobile/escrow-service-requests")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ total: 0, requests: [] })
  })

  it("respects page and limit query params", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([]) as never)
      .mockReturnValueOnce(selectChain([{ count: 0 }]) as never)

    const req = new Request(
      "http://localhost/api/mobile/escrow-service-requests?page=2&limit=5",
    )
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ page: 2, limit: 5 })
  })

  it("sets product to null when productTitle is absent", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const now = new Date()
    vi.mocked(db.select)
      .mockReturnValueOnce(
        selectChain([
          {
            id: "req-002",
            type: "seller",
            productId: null,
            packageName: null,
            message: null,
            status: "pending",
            createdAt: now,
            updatedAt: now,
            productTitle: null,
          },
        ]) as never,
      )
      .mockReturnValueOnce(selectChain([{ count: 1 }]) as never)

    const req = new Request("http://localhost/api/mobile/escrow-service-requests")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.requests[0]).toMatchObject({ product: null })
  })

  it("returns 500 when DB throws", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(db.select).mockImplementationOnce(() => {
      throw new Error("DB error")
    })

    const req = new Request("http://localhost/api/mobile/escrow-service-requests")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: "Failed to load escrow service requests" })
  })
})
