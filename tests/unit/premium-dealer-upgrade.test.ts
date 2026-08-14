import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/drizzle/db"
import * as pointsModule from "@/features/points/db/points"

vi.mock("drizzle-orm", () => ({
  and: vi.fn(() => "and"),
  eq: vi.fn(() => "eq"),
  gte: vi.fn(() => "gte"),
  gt: vi.fn(() => "gt"),
  desc: vi.fn(() => "desc"),
  sql: vi.fn((x: unknown) => x),
}))

vi.mock("@/drizzle/schema/auth-schema", () => ({
  user: {
    id: "id",
    points: "points",
    role: "role",
    premiumDealerPackageName: "premium_dealer_package_name",
    premiumDealerExpiresAt: "premium_dealer_expires_at",
  },
}))

vi.mock("@/drizzle/schema/points-schema", () => ({
  pointSetting: { key: "key", valueText: "value_text" },
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
  pointTransaction: {
    userId: "user_id",
    type: "type",
    direction: "direction",
    amount: "amount",
    status: "status",
    referenceId: "reference_id",
    referenceType: "reference_type",
    description: "description",
  },
}))

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
}))

const PACKAGES = [
  { name: "Gold", pointsRequired: 10_000, durationDays: 30 },
  { name: "Diamond", pointsRequired: 20_000, durationDays: 30 },
]

describe("premium dealer package level helpers", () => {
  it("assigns 1-based levels from admin package order", () => {
    expect(pointsModule.getPremiumDealerPackageLevel("Gold", PACKAGES)).toBe(1)
    expect(pointsModule.getPremiumDealerPackageLevel("Diamond", PACKAGES)).toBe(2)
    expect(pointsModule.getPremiumDealerPackageLevel("Missing", PACKAGES)).toBe(0)
  })

  it("filters disabled packages for mobile selection lists", () => {
    const packages = [
      ...PACKAGES,
      { name: "Platinum", pointsRequired: 30_000, durationDays: 30, enabled: false },
    ]
    expect(pointsModule.listEnabledPremiumDealerPackages(packages).map((p) => p.name)).toEqual([
      "Gold",
      "Diamond",
    ])
  })
})

describe("upgradePremiumDealerPackage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(pointsModule, "getPremiumDealersSettings").mockResolvedValue({
      packages: PACKAGES,
    })
  })

  function mockActiveSubscription() {
    const limit = vi.fn().mockResolvedValue([
      {
        id: "sub-old",
        packageName: "Gold",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-02-01T00:00:00.000Z"),
        autoRenew: true,
      },
    ])
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({ limit }),
        }),
      }),
    } as never)
  }

  it("returns 409 reason when user has no active subscription", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as never)

    const result = await pointsModule.upgradePremiumDealerPackage("user-1", "Diamond")
    expect(result).toEqual({ success: false, reason: "no_active_subscription" })
  })

  it("returns 409 when target tier is not higher", async () => {
    mockActiveSubscription()
    const result = await pointsModule.upgradePremiumDealerPackage("user-1", "Gold")
    expect(result).toEqual({ success: false, reason: "target_not_higher" })
  })

  it("returns 404 when target package does not exist", async () => {
    mockActiveSubscription()
    const result = await pointsModule.upgradePremiumDealerPackage("user-1", "Unknown")
    expect(result).toEqual({ success: false, reason: "target_package_not_found" })
  })

  it("charges only the points difference and logs premium_upgrade", async () => {
    mockActiveSubscription()

    const updateReturning = vi.fn().mockResolvedValueOnce([{ points: 5_000 }])
    const updateMock = vi.fn().mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: updateReturning }),
      }),
    }))
    const insertValues = vi.fn().mockResolvedValue(undefined)
    const tx = {
      update: updateMock,
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    }
    vi.mocked(db.transaction).mockImplementation(async (fn) => fn(tx as never))

    const result = await pointsModule.upgradePremiumDealerPackage("user-1", "Diamond")

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.pointsUsed).toBe(10_000)
    expect(result.previousPackageName).toBe("Gold")
    expect(result.packageName).toBe("Diamond")
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "premium_upgrade",
        amount: 10_000,
        direction: "debit",
      }),
    )
  })

  it("returns insufficient_points when balance is too low", async () => {
    mockActiveSubscription()

    const updateReturning = vi.fn().mockResolvedValueOnce([])
    const tx = {
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: updateReturning }),
        }),
      })),
      insert: vi.fn(),
    }
    vi.mocked(db.transaction).mockImplementation(async (fn) => fn(tx as never))

    const result = await pointsModule.upgradePremiumDealerPackage("user-1", "Diamond")
    expect(result).toEqual({ success: false, reason: "insufficient_points" })
    expect(tx.insert).not.toHaveBeenCalled()
  })
})
