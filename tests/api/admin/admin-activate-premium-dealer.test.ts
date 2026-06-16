import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  adminActivatePremiumDealerAction,
  adminCreatePointPurchaseRequestAction,
} from "@/features/points/actions/points"
import { requireActionRole } from "@/lib/action-guard"
import {
  getPremiumDealersSettings,
  activatePremiumDealer,
  adminCreatePointPurchaseRequest,
} from "@/features/points/db/points"

vi.mock("@/lib/action-guard", () => ({
  requireActionRole: vi.fn(),
}))

vi.mock("@/features/points/db/points", () => ({
  getPointManagementSettings: vi.fn(),
  savePremiumDealersSettings: vi.fn(),
  saveFeatureSettings: vi.fn(),
  savePointManagementSettings: vi.fn(),
  savePointPurchasePackagesSettings: vi.fn(),
  setDefaultRegistrationPoints: vi.fn(),
  setEarningPointsRates: vi.fn(),
  creditUserPoints: vi.fn(),
  deductUserPoints: vi.fn(),
  logPointTransaction: vi.fn(),
  approvePointPurchaseRequest: vi.fn(),
  rejectPointPurchaseRequest: vi.fn(),
  resetPointPurchaseRequestToPending: vi.fn(),
  overrideApprovePointPurchaseRequest: vi.fn(),
  overrideRejectPointPurchaseRequest: vi.fn(),
  deactivatePremiumDealerSubscription: vi.fn(),
  updatePremiumDealerSubscriptionExpiry: vi.fn(),
  getPremiumDealersSettings: vi.fn(),
  activatePremiumDealer: vi.fn(),
  adminCreatePointPurchaseRequest: vi.fn(),
}))

const mockSession = { user: { id: "admin-1", role: "admin" } }

describe("adminActivatePremiumDealerAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireActionRole as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
  })

  it("returns unauthorized when session is missing", async () => {
    ;(requireActionRole as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const fd = new FormData()
    fd.set("userId", "u1")
    fd.set("packageName", "Standard Package")
    fd.set("autoRenew", "false")
    expect(await adminActivatePremiumDealerAction(fd)).toEqual({ error: "Unauthorized" })
  })

  it("returns error when package not found in settings", async () => {
    ;(getPremiumDealersSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      packages: [{ name: "Basic Package", pointsRequired: 100, durationDays: 30 }],
    })
    const fd = new FormData()
    fd.set("userId", "u1")
    fd.set("packageName", "Nonexistent")
    fd.set("autoRenew", "false")
    expect(await adminActivatePremiumDealerAction(fd)).toEqual({
      error: "Package not found or disabled",
    })
  })

  it("returns error when activation returns null (insufficient points)", async () => {
    ;(getPremiumDealersSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      packages: [{ name: "Standard Package", pointsRequired: 250, durationDays: 30 }],
    })
    ;(activatePremiumDealer as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const fd = new FormData()
    fd.set("userId", "u1")
    fd.set("packageName", "Standard Package")
    fd.set("autoRenew", "false")
    expect(await adminActivatePremiumDealerAction(fd)).toEqual({
      error: "Insufficient points — approve a purchase request first",
    })
  })

  it("returns success with subscription details on successful activation", async () => {
    const now = new Date("2026-06-16")
    const expiry = new Date("2026-07-16")
    ;(getPremiumDealersSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      packages: [{ name: "Standard Package", pointsRequired: 250, durationDays: 30 }],
    })
    ;(activatePremiumDealer as ReturnType<typeof vi.fn>).mockResolvedValue({
      remainingPoints: 0,
      startDate: now,
      expiresAt: expiry,
      autoRenew: false,
      status: "active",
    })
    const fd = new FormData()
    fd.set("userId", "u1")
    fd.set("packageName", "Standard Package")
    fd.set("autoRenew", "false")
    expect(await adminActivatePremiumDealerAction(fd)).toEqual({
      success: true,
      remainingPoints: 0,
      startDate: now,
      expiresAt: expiry,
      autoRenew: false,
      status: "active",
    })
  })
})

describe("adminCreatePointPurchaseRequestAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireActionRole as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
  })

  it("returns unauthorized when session is missing", async () => {
    ;(requireActionRole as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const fd = new FormData()
    fd.set("userId", "u1")
    fd.set("packageName", "250 Points")
    fd.set("points", "250")
    fd.set("price", "25000")
    fd.set("currency", "mmk")
    fd.set("paymentMethod", "KBZ Pay")
    expect(await adminCreatePointPurchaseRequestAction(fd)).toEqual({ error: "Unauthorized" })
  })

  it("returns error when required fields are missing", async () => {
    const fd = new FormData()
    fd.set("userId", "u1")
    // missing packageName, points, paymentMethod, price
    expect(await adminCreatePointPurchaseRequestAction(fd)).toEqual({
      error: "Missing required fields",
    })
  })

  it("creates a pending request and returns success with id", async () => {
    ;(adminCreatePointPurchaseRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "req-1",
      status: "pending",
      createdAt: new Date(),
    })
    const fd = new FormData()
    fd.set("userId", "u1")
    fd.set("packageName", "250 Points")
    fd.set("points", "250")
    fd.set("price", "25000")
    fd.set("currency", "mmk")
    fd.set("paymentMethod", "KBZ Pay")
    expect(await adminCreatePointPurchaseRequestAction(fd)).toEqual({
      success: true,
      id: "req-1",
    })
  })
})
