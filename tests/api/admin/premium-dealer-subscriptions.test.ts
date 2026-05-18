import { beforeEach, describe, expect, it, vi } from "vitest"
import { auth } from "@/lib/auth"
import { canAdminManageUsers } from "@/features/users/permissions/users"
import {
  deactivatePremiumDealerAction,
  updateSubscriptionExpiryAction,
} from "@/features/points/actions/points"
import {
  deactivatePremiumDealerSubscription,
  updatePremiumDealerSubscriptionExpiry,
} from "@/features/points/db/points"

vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/users/permissions/users", () => ({
  canAdminManageUsers: vi.fn(),
}))
vi.mock("@/features/points/db/points", () => ({
  deactivatePremiumDealerSubscription: vi.fn(),
  updatePremiumDealerSubscriptionExpiry: vi.fn(),
  // stub everything else actions.ts imports at module level
  getDefaultRegistrationPoints: vi.fn(),
  getEarningPointsRates: vi.fn(),
  getPremiumDealersSettings: vi.fn(),
  getFeatureSettings: vi.fn(),
  getPointManagementSettings: vi.fn(),
  savePremiumDealersSettings: vi.fn(),
  saveFeatureSettings: vi.fn(),
  savePointManagementSettings: vi.fn(),
  savePointPurchasePackagesSettings: vi.fn(),
  setDefaultRegistrationPoints: vi.fn(),
  setEarningPointsRates: vi.fn(),
  setUserPoints: vi.fn(),
  approvePointPurchaseRequest: vi.fn(),
  rejectPointPurchaseRequest: vi.fn(),
}))

const ADMIN_SESSION = { user: { id: "admin-1", role: "admin" } }

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe("deactivatePremiumDealerAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    vi.mocked(canAdminManageUsers).mockReturnValue(false)
  })

  it("returns error when not authenticated", async () => {
    const result = await deactivatePremiumDealerAction(makeFormData({ subscriptionId: "sub-1" }))
    expect(result).toEqual({ error: "Unauthorized" })
    expect(deactivatePremiumDealerSubscription).not.toHaveBeenCalled()
  })

  it("returns error when subscriptionId is missing", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN_SESSION as never)
    vi.mocked(canAdminManageUsers).mockReturnValue(true)

    const result = await deactivatePremiumDealerAction(makeFormData({}))
    expect(result).toEqual({ error: "Subscription ID is required." })
    expect(deactivatePremiumDealerSubscription).not.toHaveBeenCalled()
  })

  it("returns error when subscription is not found", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN_SESSION as never)
    vi.mocked(canAdminManageUsers).mockReturnValue(true)
    vi.mocked(deactivatePremiumDealerSubscription).mockResolvedValue({
      success: false,
      reason: "not_found",
    })

    const result = await deactivatePremiumDealerAction(makeFormData({ subscriptionId: "sub-1" }))
    expect(result).toEqual({ error: "Subscription not found." })
  })

  it("returns error when subscription is not active", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN_SESSION as never)
    vi.mocked(canAdminManageUsers).mockReturnValue(true)
    vi.mocked(deactivatePremiumDealerSubscription).mockResolvedValue({
      success: false,
      reason: "not_active",
    })

    const result = await deactivatePremiumDealerAction(makeFormData({ subscriptionId: "sub-1" }))
    expect(result).toEqual({ error: "Subscription is not active." })
  })

  it("returns success when deactivation succeeds", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN_SESSION as never)
    vi.mocked(canAdminManageUsers).mockReturnValue(true)
    vi.mocked(deactivatePremiumDealerSubscription).mockResolvedValue({ success: true })

    const result = await deactivatePremiumDealerAction(makeFormData({ subscriptionId: "sub-1" }))
    expect(result).toEqual({ success: true })
    expect(deactivatePremiumDealerSubscription).toHaveBeenCalledWith("sub-1")
  })
})

describe("updateSubscriptionExpiryAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    vi.mocked(canAdminManageUsers).mockReturnValue(false)
  })

  it("returns error when not authenticated", async () => {
    const result = await updateSubscriptionExpiryAction(
      makeFormData({ subscriptionId: "sub-1", newEndDate: "2026-12-01" })
    )
    expect(result).toEqual({ error: "Unauthorized" })
  })

  it("returns error when subscriptionId is missing", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN_SESSION as never)
    vi.mocked(canAdminManageUsers).mockReturnValue(true)

    const result = await updateSubscriptionExpiryAction(
      makeFormData({ newEndDate: "2026-12-01" })
    )
    expect(result).toEqual({ error: "Subscription ID is required." })
  })

  it("returns error when newEndDate is missing", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN_SESSION as never)
    vi.mocked(canAdminManageUsers).mockReturnValue(true)

    const result = await updateSubscriptionExpiryAction(
      makeFormData({ subscriptionId: "sub-1" })
    )
    expect(result).toEqual({ error: "A valid future date is required." })
  })

  it("returns error when newEndDate is not a valid date", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN_SESSION as never)
    vi.mocked(canAdminManageUsers).mockReturnValue(true)

    const result = await updateSubscriptionExpiryAction(
      makeFormData({ subscriptionId: "sub-1", newEndDate: "not-a-date" })
    )
    expect(result).toEqual({ error: "A valid future date is required." })
  })

  it("returns error when subscription is not found", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN_SESSION as never)
    vi.mocked(canAdminManageUsers).mockReturnValue(true)
    vi.mocked(updatePremiumDealerSubscriptionExpiry).mockResolvedValue({
      success: false,
      reason: "not_found",
    })

    const result = await updateSubscriptionExpiryAction(
      makeFormData({ subscriptionId: "sub-1", newEndDate: "2099-12-01" })
    )
    expect(result).toEqual({ error: "Subscription not found." })
  })

  it("returns success when expiry update succeeds", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN_SESSION as never)
    vi.mocked(canAdminManageUsers).mockReturnValue(true)
    vi.mocked(updatePremiumDealerSubscriptionExpiry).mockResolvedValue({ success: true })

    const result = await updateSubscriptionExpiryAction(
      makeFormData({ subscriptionId: "sub-1", newEndDate: "2099-12-01" })
    )
    expect(result).toEqual({ success: true })
    expect(updatePremiumDealerSubscriptionExpiry).toHaveBeenCalledWith(
      "sub-1",
      expect.any(Date)
    )
  })
})
