import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }))
vi.mock("@/features/points/services/enqueue-surprise-bonus", () => ({
  enqueueSurpriseBonusForAllUsers: vi.fn(),
}))

const { auth } = await import("@/lib/auth")
const { checkInternalAccess } = await import("@/features/rbac/db/permissions")
const { enqueueSurpriseBonusForAllUsers } = await import(
  "@/features/points/services/enqueue-surprise-bonus"
)
const { enqueueSurpriseBonusAction } = await import("@/features/points/actions/points")

describe("enqueueSurpriseBonusAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects with no session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    const result = await enqueueSurpriseBonusAction("Sweet December", 500)
    expect(result).toEqual({ error: "Unauthorized" })
    expect(enqueueSurpriseBonusForAllUsers).not.toHaveBeenCalled()
  })

  it("rejects internal staff without the credit transactions permission", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "staff-1", role: "internal" },
    } as never)
    vi.mocked(checkInternalAccess).mockResolvedValue(false)
    const result = await enqueueSurpriseBonusAction("Sweet December", 500)
    expect(result).toEqual({ error: "Unauthorized" })
    expect(enqueueSurpriseBonusForAllUsers).not.toHaveBeenCalled()
  })

  it("allows internal staff holding the credit transactions permission", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "staff-1", role: "internal" },
    } as never)
    vi.mocked(checkInternalAccess).mockResolvedValue(true)
    vi.mocked(enqueueSurpriseBonusForAllUsers).mockResolvedValue({
      success: true,
      campaignId: "camp-1",
      totalUsers: 100,
      pointsPerUser: 500,
      campaignName: "Sweet December",
    })
    const result = await enqueueSurpriseBonusAction("Sweet December", 500)
    expect(result).toEqual({
      success: true,
      campaignId: "camp-1",
      totalUsers: 100,
      pointsPerUser: 500,
      campaignName: "Sweet December",
    })
  })

  it("enqueues campaign for an admin and passes createdBy through", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never)
    vi.mocked(enqueueSurpriseBonusForAllUsers).mockResolvedValue({
      success: true,
      campaignId: "camp-1",
      totalUsers: 100,
      pointsPerUser: 500,
      campaignName: "Sweet December",
    })

    const result = await enqueueSurpriseBonusAction("Sweet December", 500, "note")
    expect("error" in result).toBe(false)
    expect(enqueueSurpriseBonusForAllUsers).toHaveBeenCalledWith({
      campaignName: "Sweet December",
      pointsPerUser: 500,
      note: "note",
      createdBy: "admin-1",
    })
  })

  it("surfaces a validation error from the service", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never)
    vi.mocked(enqueueSurpriseBonusForAllUsers).mockResolvedValue({
      error: "Amount must be a positive number.",
    })

    const result = await enqueueSurpriseBonusAction("Sweet December", -5)
    expect(result).toEqual({ error: "Amount must be a positive number." })
  })
})
