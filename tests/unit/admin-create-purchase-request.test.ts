import { beforeEach, describe, expect, it, vi } from "vitest"
import { adminCreatePointPurchaseRequest } from "@/features/points/db/points"
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
  count: vi.fn(() => "count"),
  lte: vi.fn(() => "lte"),
  ilike: vi.fn(() => "ilike"),
}))

vi.mock("@/drizzle/schema/auth-schema", () => ({
  user: {
    id: "id", points: "points", role: "role",
    premiumDealerPackageName: "premium_dealer_package_name",
    premiumDealerExpiresAt: "premium_dealer_expires_at",
    email: "email", name: "name",
  },
}))

vi.mock("@/drizzle/schema/points-schema", () => ({
  pointSetting: { key: "key", valueText: "value_text" },
  pointPurchaseRequest: {
    id: "id", userId: "user_id", points: "points", status: "status",
    packageName: "package_name", price: "price", currency: "currency",
    paymentMethod: "payment_method", transferredAmount: "transferred_amount",
    transferredName: "transferred_name", transactionReference: "transaction_reference",
    transferNote: "transfer_note", createdAt: "created_at",
  },
  premiumDealersPackage: {
    id: "id", userId: "user_id", packageName: "package_name",
    startDate: "start_date", endDate: "end_date", autoRenew: "auto_renew", status: "status",
  },
  pointTransaction: {
    id: "id", userId: "user_id", type: "type", direction: "direction", amount: "amount",
    status: "status", referenceId: "reference_id", referenceType: "reference_type",
    description: "description", paymentMethod: "payment_method", createdAt: "created_at",
  },
}))

vi.mock("@/drizzle/db", () => ({
  db: { insert: vi.fn() },
}))

describe("adminCreatePointPurchaseRequest", () => {
  const fakeRow = { id: "req-1", status: "pending", createdAt: new Date("2026-06-16") }

  beforeEach(() => { vi.clearAllMocks() })

  it("inserts a pending purchase request and returns it", async () => {
    const mockInsertPR = {
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([fakeRow]),
      }),
    }
    const mockInsertTx = {
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "tx-1" }]),
      }),
    }
    ;(db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockInsertPR)
      .mockReturnValueOnce(mockInsertTx)

    const result = await adminCreatePointPurchaseRequest({
      userId: "user-1",
      packageName: "Standard Package",
      points: 250,
      price: 25000,
      currency: "mmk",
      paymentMethod: "KBZ Pay",
    })

    expect(result).toEqual(fakeRow)
    expect(db.insert).toHaveBeenCalledTimes(2)
  })

  it("passes optional payment proof fields to the insert", async () => {
    const mockInsertPR = {
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([fakeRow]),
      }),
    }
    const mockInsertTx = {
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "tx-1" }]),
      }),
    }
    ;(db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockInsertPR)
      .mockReturnValueOnce(mockInsertTx)

    await adminCreatePointPurchaseRequest({
      userId: "user-1",
      packageName: "Basic Package",
      points: 100,
      price: 10000,
      currency: "mmk",
      paymentMethod: "AYA Pay",
      transferredAmount: 10000,
      transferredName: "Mg Mg",
      transactionReference: "TXN-123",
      transferNote: "For Standard Package",
    })

    expect(mockInsertPR.values).toHaveBeenCalledWith(
      expect.objectContaining({
        transferredAmount: 10000,
        transferredName: "Mg Mg",
        transactionReference: "TXN-123",
        transferNote: "For Standard Package",
      })
    )
  })
})
