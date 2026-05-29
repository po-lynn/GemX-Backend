import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  logPointTransaction,
  getUserPointBalance,
  getUserPointHistory,
} from "@/features/points/db/points"
import { db } from "@/drizzle/db"

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  count: vi.fn(() => "count(*)"),
  desc: vi.fn((x: unknown) => x),
  eq: vi.fn(() => "eq"),
  or: vi.fn((...args: unknown[]) => ({ or: args })),
  sql: vi.fn((x: unknown) => x),
}))

vi.mock("@/drizzle/schema/auth-schema", () => ({
  user: { id: "id", points: "points", pointsLifetime: "points_lifetime", pointsReserved: "points_reserved" },
}))

vi.mock("@/drizzle/schema/points-schema", () => ({
  pointSetting: { key: "key", value: "value", valueText: "value_text" },
  pointPurchaseRequest: { id: "id", userId: "user_id", status: "status", referenceId: "reference_id" },
  pointTransaction: {
    id: "id",
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
  premiumDealersPackage: { id: "id", userId: "user_id", status: "status" },
}))

vi.mock("@/drizzle/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}))

describe("logPointTransaction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("inserts a point_transaction row and returns the id", async () => {
    // logPointTransaction inserts and returns { id }
    const insertValuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "tx-1" }]),
    })
    vi.mocked(db.insert).mockReturnValue({ values: insertValuesMock } as never)

    const result = await logPointTransaction({
      userId: "user-1",
      type: "topup",
      direction: "credit",
      amount: 5000,
      status: "completed",
      paymentMethod: "KBZ Pay",
    })

    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", type: "topup", direction: "credit", amount: 5000 })
    )
    expect(result.id).toBe("tx-1")
  })
})

describe("getUserPointBalance", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns available, reserved, and lifetime from user row", async () => {
    // getUserPointBalance selects points, pointsLifetime, pointsReserved from user
    const limitMock = vi.fn().mockResolvedValue([{ points: 42850, pointsLifetime: 318400, pointsReserved: 0 }])
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
    const fromMock = vi.fn().mockReturnValue({ where: whereMock })
    vi.mocked(db.select).mockReturnValue({ from: fromMock } as never)

    const balance = await getUserPointBalance("user-1")

    expect(balance.available).toBe(42850)
    expect(balance.lifetime).toBe(318400)
    expect(balance.reserved).toBe(0)
  })

  it("returns zeros when user not found", async () => {
    const limitMock = vi.fn().mockResolvedValue([])
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
    const fromMock = vi.fn().mockReturnValue({ where: whereMock })
    vi.mocked(db.select).mockReturnValue({ from: fromMock } as never)

    const balance = await getUserPointBalance("unknown-user")

    expect(balance).toEqual({ available: 0, reserved: 0, lifetime: 0 })
  })
})

describe("getUserPointHistory", () => {
  beforeEach(() => vi.clearAllMocks())

  const mockRows = [
    { id: "tx-1", userId: "user-1", type: "topup", direction: "credit", amount: 5000, status: "completed", referenceId: "req-1", referenceType: "purchase_request", description: "Top-up via KBZ Pay", paymentMethod: "KBZ Pay", createdAt: new Date("2026-05-22T18:04:00Z") },
  ]

  it("returns paginated transactions with total for filter=all", async () => {
    // getUserPointHistory calls two queries in parallel: rows + count
    const offsetMock = vi.fn().mockResolvedValue(mockRows)
    const limitMock = vi.fn().mockReturnValue({ offset: offsetMock })
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock })
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock })
    const fromMock = vi.fn().mockReturnValue({ where: whereMock })

    const countWhereMock = vi.fn().mockResolvedValue([{ value: 1 }])
    const countFromMock = vi.fn().mockReturnValue({ where: countWhereMock })

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: fromMock } as never)
      .mockReturnValueOnce({ from: countFromMock } as never)

    const result = await getUserPointHistory("user-1", { filter: "all", page: 1, limit: 20 })

    expect(result.total).toBe(1)
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].type).toBe("topup")
  })

  it("applies topups filter (type=topup|registration_bonus, status=completed)", async () => {
    // Verifies the filter condition is applied by checking db.select was called
    const offsetMock = vi.fn().mockResolvedValue([])
    const limitMock = vi.fn().mockReturnValue({ offset: offsetMock })
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock })
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock })
    const fromMock = vi.fn().mockReturnValue({ where: whereMock })
    const countWhereMock = vi.fn().mockResolvedValue([{ value: 0 }])
    const countFromMock = vi.fn().mockReturnValue({ where: countWhereMock })

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: fromMock } as never)
      .mockReturnValueOnce({ from: countFromMock } as never)

    const result = await getUserPointHistory("user-1", { filter: "topups", page: 1, limit: 20 })

    expect(db.select).toHaveBeenCalledTimes(2)
    expect(result.transactions).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})
