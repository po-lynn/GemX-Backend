import { beforeEach, describe, expect, it, vi } from "vitest"
import { activatePremiumDealer } from "@/features/points/db/points"
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
    email: "email",
    name: "name",
    username: "username",
    image: "image",
  },
}))

vi.mock("@/drizzle/schema/points-schema", () => ({
  pointSetting: { key: "key", value: "value", valueText: "value_text" },
  pointPurchaseRequest: {
    id: "id",
    userId: "user_id",
    points: "points",
    status: "status",
    packageName: "package_name",
    price: "price",
    currency: "currency",
    transferredAmount: "transferred_amount",
    transferredName: "transferred_name",
    transactionReference: "transaction_reference",
    transferNote: "transfer_note",
    adminNote: "admin_note",
    reviewedByAdminId: "reviewed_by_admin_id",
    reviewedAt: "reviewed_at",
    createdAt: "created_at",
  },
  premiumDealersPackage: {
    id: "id",
    userId: "user_id",
    packageName: "package_name",
    startDate: "start_date",
    endDate: "end_date",
    autoRenew: "auto_renew",
    status: "status",
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
    paymentMethod: "payment_method",
    createdAt: "created_at",
  },
}))

vi.mock("@/drizzle/db", () => ({
  db: {
    transaction: vi.fn(),
  },
}))

describe("activatePremiumDealer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("writes premium dealer activation record on success", async () => {
    const updateReturningMock = vi
      .fn()
      .mockResolvedValueOnce([{ points: 900 }])
      .mockResolvedValueOnce([])
    const updateMock = vi.fn().mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: updateReturningMock,
        }),
      }),
    }))
    const insertValuesMock = vi.fn().mockResolvedValue(undefined)
    const tx = {
      update: updateMock,
      insert: vi.fn().mockReturnValue({
        values: insertValuesMock,
      }),
    }
    vi.mocked(db.transaction).mockImplementation(async (fn) => fn(tx as never))

    const pkg = { name: "Basic Package", pointsRequired: 100, durationDays: 30 }
    const result = await activatePremiumDealer("user-1", pkg, true)

    expect(result).toBeTruthy()
    expect(result?.remainingPoints).toBe(900)
    expect(result?.autoRenew).toBe(true)
    expect(result?.status).toBe("active")
    // insert called twice: once for the subscription, once for the point_transaction log
    expect(tx.insert).toHaveBeenCalledTimes(2)
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        packageName: "Basic Package",
        autoRenew: true,
        status: "active",
      })
    )
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: "premium_activation",
        direction: "debit",
        status: "completed",
      })
    )
  })

  it("returns null and does not insert activation when points are insufficient", async () => {
    const updateReturningMock = vi.fn().mockResolvedValueOnce([])
    const updateMock = vi.fn().mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: updateReturningMock,
        }),
      }),
    }))
    const tx = {
      update: updateMock,
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    }
    vi.mocked(db.transaction).mockImplementation(async (fn) => fn(tx as never))

    const pkg = { name: "Basic Package", pointsRequired: 100, durationDays: 30 }
    const result = await activatePremiumDealer("user-1", pkg, false)

    expect(result).toBeNull()
    expect(tx.insert).not.toHaveBeenCalled()
  })
})
