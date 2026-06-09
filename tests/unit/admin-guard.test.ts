// tests/unit/admin-guard.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))
vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
}))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/features/rbac/db/permissions", () => ({
  checkSupervisorAccess: vi.fn(),
}))

import { requireAdmin, requireFeatureAccess } from "@/lib/admin-guard"
import { auth } from "@/lib/auth"
import { checkSupervisorAccess } from "@/features/rbac/db/permissions"

// ReturnType of the real getSession — used to satisfy mockResolvedValue's type
type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>

const mockSession = (role: string, id: string): SessionResult =>
  ({ user: { role, id } }) as unknown as SessionResult

const adminSess = () => mockSession("admin", "u1")
const supSess   = () => mockSession("supervisor", "u2")

describe("requireAdmin", () => {
  beforeEach(() => vi.clearAllMocks())

  it("redirects to /login when unauthenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/login")
  })
  it("redirects to /admin when role is supervisor", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(supSess())
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin")
  })
  it("returns session when role is admin", async () => {
    const s = adminSess()
    vi.mocked(auth.api.getSession).mockResolvedValue(s)
    expect(await requireAdmin()).toBe(s)
  })
})

describe("requireFeatureAccess", () => {
  beforeEach(() => vi.clearAllMocks())

  it("redirects to /login when unauthenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    await expect(requireFeatureAccess("products")).rejects.toThrow("REDIRECT:/login")
  })
  it("returns session for admin without DB check", async () => {
    const s = adminSess()
    vi.mocked(auth.api.getSession).mockResolvedValue(s)
    expect(await requireFeatureAccess("products")).toBe(s)
    expect(checkSupervisorAccess).not.toHaveBeenCalled()
  })
  it("returns session for supervisor when feature is permitted", async () => {
    const s = supSess()
    vi.mocked(auth.api.getSession).mockResolvedValue(s)
    vi.mocked(checkSupervisorAccess).mockResolvedValue(true)
    expect(await requireFeatureAccess("products")).toBe(s)
  })
  it("redirects to /admin for supervisor when feature is denied", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(supSess())
    vi.mocked(checkSupervisorAccess).mockResolvedValue(false)
    await expect(requireFeatureAccess("products")).rejects.toThrow("REDIRECT:/admin")
  })
  it("redirects to /admin for unknown role", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession("user", "u3"))
    await expect(requireFeatureAccess("products")).rejects.toThrow("REDIRECT:/admin")
  })
})
