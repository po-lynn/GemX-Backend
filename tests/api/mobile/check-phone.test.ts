import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/mobile/check-phone/route"
import { getUserEmailByPhone } from "@/features/users/db/users"
import { rateLimit } from "@/lib/rate-limit"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/users/db/users", () => ({
  getUserEmailByPhone: vi.fn(),
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ allowed: true })),
}))

describe("POST /api/mobile/check-phone", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimit).mockReturnValue({ allowed: true })
  })

  // Signup form: phone already registered → exists true / available false.
  it("returns exists=true when the normalized phone is registered", async () => {
    vi.mocked(getUserEmailByPhone).mockResolvedValue("user_959123456789@phone.local")
    const req = new Request("http://localhost/api/mobile/check-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "09123456789" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      exists: true,
      available: false,
      phone: "+959123456789",
    })
    expect(getUserEmailByPhone).toHaveBeenCalledWith("+959123456789")
  })

  // Signup form: unused phone → can proceed.
  it("returns exists=false when the phone is not registered", async () => {
    vi.mocked(getUserEmailByPhone).mockResolvedValue(null)
    const req = new Request("http://localhost/api/mobile/check-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+959987654321" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      exists: false,
      available: true,
      phone: "+959987654321",
    })
  })

  it("returns 400 for an invalid phone format", async () => {
    const req = new Request("http://localhost/api/mobile/check-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "12345" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining("09"),
    })
    expect(getUserEmailByPhone).not.toHaveBeenCalled()
  })

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimit).mockReturnValue({ allowed: false, retryAfterMs: 5000 })
    const req = new Request("http://localhost/api/mobile/check-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "09123456789" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("5")
  })
})
