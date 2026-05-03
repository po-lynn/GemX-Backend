import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET } from "@/app/api/mobile/escrow-chat-user/route"
import { auth } from "@/lib/auth"
import * as escrowDb from "@/features/escrow-service-settings/db/escrow-service-settings"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/escrow-service-settings/db/escrow-service-settings", () => ({
  getEscrowServiceChatUser: vi.fn(),
}))

describe("GET /api/mobile/escrow-chat-user", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })

  it("returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/api/mobile/escrow-chat-user") as NextRequest
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns configured user when set", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "u1" },
    } as Awaited<ReturnType<typeof auth.api.getSession>>)
    vi.mocked(escrowDb.getEscrowServiceChatUser).mockResolvedValue({
      configured: true,
      user: {
        id: "escrow-admin",
        name: "Escrow Desk",
        image: "https://example.com/a.png",
        role: "admin",
      },
    })

    const req = new Request("http://localhost/api/mobile/escrow-chat-user") as NextRequest
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      success: boolean
      configured: boolean
      user: { id: string; name: string; image: string | null; role: string } | null
    }
    expect(body.success).toBe(true)
    expect(body.configured).toBe(true)
    expect(body.user?.id).toBe("escrow-admin")
    expect(body.user?.name).toBe("Escrow Desk")
  })

  it("returns configured false when no escrow chat user", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "u1" },
    } as Awaited<ReturnType<typeof auth.api.getSession>>)
    vi.mocked(escrowDb.getEscrowServiceChatUser).mockResolvedValue({
      configured: false,
      user: null,
    })

    const req = new Request("http://localhost/api/mobile/escrow-chat-user") as NextRequest
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { configured: boolean; user: null }
    expect(body.configured).toBe(false)
    expect(body.user).toBeNull()
  })
})
