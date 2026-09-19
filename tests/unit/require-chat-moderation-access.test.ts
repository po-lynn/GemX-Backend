// tests/unit/require-chat-moderation-access.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))
vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
}))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/features/rbac/db/permissions", () => ({
  checkInternalAccess: vi.fn(),
}))

import { requireChatModerationAccess } from "@/features/chat-moderation/lib/require-chat-moderation-access"
import { auth } from "@/lib/auth"
import { checkInternalAccess } from "@/features/rbac/db/permissions"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>
const mockSession = (role: string, id: string): SessionResult => ({ user: { role, id } }) as unknown as SessionResult

describe("requireChatModerationAccess", () => {
  beforeEach(() => vi.clearAllMocks())

  it("redirects to /login when unauthenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    await expect(requireChatModerationAccess()).rejects.toThrow("REDIRECT:/login")
  })

  it("returns session for admin without a DB check", async () => {
    const s = mockSession("admin", "u1")
    vi.mocked(auth.api.getSession).mockResolvedValue(s)
    expect(await requireChatModerationAccess()).toBe(s)
    expect(checkInternalAccess).not.toHaveBeenCalled()
  })

  it("returns session for internal staff with the chat moderation permission", async () => {
    const s = mockSession("internal", "u2")
    vi.mocked(auth.api.getSession).mockResolvedValue(s)
    vi.mocked(checkInternalAccess).mockImplementation(async (_id, key) => key === FEATURE_KEYS.CHAT_MODERATION)
    expect(await requireChatModerationAccess()).toBe(s)
  })

  it("redirects to /admin for internal staff without the permission", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession("internal", "u3"))
    vi.mocked(checkInternalAccess).mockResolvedValue(false)
    await expect(requireChatModerationAccess()).rejects.toThrow("REDIRECT:/admin")
  })

  it("redirects to /admin for an unknown role", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession("user", "u4"))
    await expect(requireChatModerationAccess()).rejects.toThrow("REDIRECT:/admin")
  })
})
