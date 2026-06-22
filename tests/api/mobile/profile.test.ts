import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"
import { PATCH } from "@/app/api/mobile/profile/route"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/drizzle/db", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}))
vi.mock("@/drizzle/schema", () => ({ user: {} }))

function makeReq(body: unknown): NextRequest {
  return {
    headers: new Headers(),
    json: () => Promise.resolve(body),
  } as unknown as NextRequest
}

describe("PATCH /api/mobile/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", role: "user" },
    } as never)
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as never)
  })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    const res = await PATCH(makeReq({ nrc: "12/ABC(N)123456" }))
    expect(res.status).toBe(401)
  })

  it("returns 200 with ok:true on valid body", async () => {
    const res = await PATCH(makeReq({ nrc: "12/ABC(N)123456", city: "Yangon" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it("silently ignores verified and role fields sent in body", async () => {
    // verified and role are not in profileUpdateSchema, so Zod strips them
    // This results in an empty updates object, which skips the db.update call
    const res = await PATCH(makeReq({ verified: true, role: "admin" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
    // Confirm db.update was not called (no valid fields provided)
    expect(db.update).not.toHaveBeenCalled()
  })

  it("returns 200 when body is an empty object (no-op)", async () => {
    const res = await PATCH(makeReq({}))
    expect(res.status).toBe(200)
    // Confirm db.update was not called when no updates provided
    expect(db.update).not.toHaveBeenCalled()
  })

  it("returns 400 when nrcFrontUrl is not a valid URL", async () => {
    const res = await PATCH(makeReq({ nrcFrontUrl: "not-a-url" }))
    expect(res.status).toBe(400)
  })

  it("accepts null to clear a doc URL field", async () => {
    const res = await PATCH(makeReq({ nrcFrontUrl: null }))
    expect(res.status).toBe(200)
  })

  it("accepts valid https URL for doc fields", async () => {
    const res = await PATCH(makeReq({
      nrcFrontUrl: "https://example.com/nrc-front.jpg",
      selfieUrl: "https://example.com/selfie.jpg",
    }))
    expect(res.status).toBe(200)
  })
})
