// tests/unit/require-messages-access.test.ts
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

import { requireMessagesAccess } from "@/features/messages/lib/require-messages-access"
import { auth } from "@/lib/auth"
import { checkInternalAccess } from "@/features/rbac/db/permissions"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>
const mockSession = (role: string, id: string): SessionResult => ({ user: { role, id } }) as unknown as SessionResult

describe("requireMessagesAccess", () => {
  beforeEach(() => vi.clearAllMocks())

  it("redirects to /login when unauthenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    await expect(requireMessagesAccess()).rejects.toThrow("REDIRECT:/login")
  })

  it("returns session for admin without a DB check", async () => {
    const s = mockSession("admin", "u1")
    vi.mocked(auth.api.getSession).mockResolvedValue(s)
    expect(await requireMessagesAccess()).toBe(s)
    expect(checkInternalAccess).not.toHaveBeenCalled()
  })

  it("returns session for internal staff with only the messages permission", async () => {
    const s = mockSession("internal", "u2")
    vi.mocked(auth.api.getSession).mockResolvedValue(s)
    vi.mocked(checkInternalAccess).mockImplementation(async (_id, key) => key === FEATURE_KEYS.MESSAGES)
    expect(await requireMessagesAccess()).toBe(s)
  })

  it("returns session for internal staff with only the legacy chat_dashboard permission", async () => {
    const s = mockSession("internal", "u3")
    vi.mocked(auth.api.getSession).mockResolvedValue(s)
    vi.mocked(checkInternalAccess).mockImplementation(async (_id, key) => key === FEATURE_KEYS.CHAT_DASHBOARD)
    expect(await requireMessagesAccess()).toBe(s)
  })

  it("redirects to /admin for internal staff with neither permission", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession("internal", "u4"))
    vi.mocked(checkInternalAccess).mockResolvedValue(false)
    await expect(requireMessagesAccess()).rejects.toThrow("REDIRECT:/admin")
  })

  it("redirects to /admin for an unknown role", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession("user", "u5"))
    await expect(requireMessagesAccess()).rejects.toThrow("REDIRECT:/admin")
  })
})
