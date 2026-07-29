import { beforeEach, describe, expect, it, vi } from "vitest"
import { setPremiumDealerAutoRenew } from "@/features/points/db/points"
import { db } from "@/drizzle/db"

vi.mock("drizzle-orm", () => ({
  and: vi.fn(() => "and"),
  eq: vi.fn(() => "eq"),
  gte: vi.fn(() => "gte"),
  gt: vi.fn(() => "gt"),
  inArray: vi.fn(() => "inArray"),
  isNotNull: vi.fn(() => "isNotNull"),
  isNull: vi.fn(() => "isNull"),
  desc: vi.fn(() => "desc"),
  or: vi.fn(() => "or"),
  sql: vi.fn((x: unknown) => x),
}))

vi.mock("@/drizzle/schema/auth-schema", () => ({
  user: {
    id: "id",
    points: "points",
    premiumDealerPackageName: "premium_dealer_package_name",
    premiumDealerExpiresAt: "premium_dealer_expires_at",
  },
}))

vi.mock("@/drizzle/schema/points-schema", () => ({
  premiumDealersPackage: {
    id: "id",
    userId: "user_id",
    packageName: "package_name",
    startDate: "start_date",
    endDate: "end_date",
    autoRenew: "auto_renew",
    status: "status",
    createdAt: "created_at",
  },
}))

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))

describe("setPremiumDealerAutoRenew", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // No active, non-expired row → nothing to update, returns null.
  it("returns null when the user has no active subscription", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as never)

    const result = await setPremiumDealerAutoRenew("user-1", true)

    expect(result).toBeNull()
    expect(db.update).not.toHaveBeenCalled()
  })

  // Active row found → updates that specific row and returns the new flag.
  it("updates the current active subscription row", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "sub-1" }]),
          }),
        }),
      }),
    } as never)

    const updateWhereMock = vi.fn().mockResolvedValue(undefined)
    const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock })
    vi.mocked(db.update).mockReturnValue({ set: updateSetMock } as never)

    const result = await setPremiumDealerAutoRenew("user-1", false)

    expect(result).toEqual({ autoRenew: false })
    expect(updateSetMock).toHaveBeenCalledWith({ autoRenew: false })
    expect(updateWhereMock).toHaveBeenCalled()
  })
})
