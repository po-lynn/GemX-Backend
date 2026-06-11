import { describe, it, expect, vi, beforeEach } from "vitest"
import { auth } from "@/lib/auth"
import { requireActionRole } from "@/lib/action-guard"

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))

describe("requireActionRole", () => {
  beforeEach(() => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })

  // No cookie session → guard rejects
  it("returns null when there is no session", async () => {
    expect(await requireActionRole(() => true)).toBeNull()
  })

  // Session exists but role check fails → guard rejects
  it("returns null when the role check fails", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never)
    expect(await requireActionRole((role) => role === "admin")).toBeNull()
  })

  // Role check passes → full session is returned for use (e.g. session.user.id)
  it("returns the session when the role check passes", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "u1", role: "admin" },
    } as never)
    const session = await requireActionRole((role) => role === "admin")
    expect(session?.user.id).toBe("u1")
  })
})
