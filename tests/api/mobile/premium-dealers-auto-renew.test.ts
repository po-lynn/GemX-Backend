import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { PATCH } from "@/app/api/mobile/premium-dealers/auto-renew/route"
import { auth } from "@/lib/auth"
import { setPremiumDealerAutoRenew } from "@/features/points/db/points"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/points/db/points", () => ({
  setPremiumDealerAutoRenew: vi.fn(),
}))

const SESSION = { user: { id: "user-1" } }

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/mobile/premium-dealers/auto-renew", {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as NextRequest
}

describe("PATCH /api/mobile/premium-dealers/auto-renew", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })

  // Unauthenticated requests must be rejected before touching the DB.
  it("returns 401 when unauthenticated", async () => {
    const res = await PATCH(makeRequest({ autoRenew: true }))
    expect(res.status).toBe(401)
    expect(setPremiumDealerAutoRenew).not.toHaveBeenCalled()
  })

  // Zod requires autoRenew to be a boolean.
  it("returns 400 for invalid input when autoRenew is missing", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const res = await PATCH(makeRequest({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "Invalid input" })
  })

  // Zod requires autoRenew to be a boolean, not a truthy string.
  it("returns 400 for invalid input when autoRenew is not a boolean", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const res = await PATCH(makeRequest({ autoRenew: "true" }))
    expect(res.status).toBe(400)
  })

  // No active, non-expired subscription row to toggle.
  it("returns 400 when user has no active subscription", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(setPremiumDealerAutoRenew).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ autoRenew: false }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "No active premium dealer subscription" })
  })

  // Happy path: turning auto-renew off persists via the db helper.
  it("returns 200 and turns auto-renew off", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(setPremiumDealerAutoRenew).mockResolvedValue({ autoRenew: false })

    const res = await PATCH(makeRequest({ autoRenew: false }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(setPremiumDealerAutoRenew).toHaveBeenCalledWith(SESSION.user.id, false)
    expect(body).toEqual({ success: true, autoRenew: false })
  })

  // Happy path: turning auto-renew back on.
  it("returns 200 and turns auto-renew on", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(setPremiumDealerAutoRenew).mockResolvedValue({ autoRenew: true })

    const res = await PATCH(makeRequest({ autoRenew: true }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(setPremiumDealerAutoRenew).toHaveBeenCalledWith(SESSION.user.id, true)
    expect(body).toEqual({ success: true, autoRenew: true })
  })
})
