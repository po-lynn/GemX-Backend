import { describe, it, expect, vi, beforeEach } from "vitest"

// Regression coverage for the registration-bonus atomicity fix: the balance
// write and the pointTransaction ledger row must commit in the same
// db.transaction(), never as two separate top-level calls. Before this fix,
// a crash between them left the balance bumped with no ledger row — for
// monthly-bonus grants that ledger row is the sole proof a user was already
// paid, so the same gap there would double-credit on the next cron run
// (see tests/unit/monthly-bonus.test.ts and features/points/db/monthly-bonus.ts).
const { transaction, select, update, insert } = vi.hoisted(() => ({
  transaction: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}))

vi.mock("@/drizzle/db", () => ({
  db: { select, update, insert, transaction },
}))

vi.mock("@/drizzle/schema/auth-schema", () => ({
  user: { id: "id", points: "points", pointsLifetime: "points_lifetime", email: "email" },
}))

vi.mock("@/drizzle/schema/points-schema", () => ({
  pointSetting: { key: "key", value: "value", valueText: "value_text" },
  pointPurchaseRequest: {},
  premiumDealersPackage: {},
  pointTransaction: { id: "id" },
}))

vi.mock("@/drizzle/schema/seller-rating-schema", () => ({ sellerRating: {} }))

function mockSelectOnce(rows: unknown[]) {
  select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never)
}

describe("registration bonus — atomic credit + ledger write", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Every tx op used by applyDefaultPointsToNewUser / creditDefaultRegistrationPointsToUser
    // (via creditUserPoints/logPointTransaction) resolves through this shared tx double.
    const tx = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ points: 100 }]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "tx1" }]),
        }),
      }),
    }
    transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(tx))
  })

  it("applyDefaultPointsToNewUser writes the balance and ledger row inside one db.transaction", async () => {
    mockSelectOnce([{ value: 100 }]) // DEFAULT_REGISTRATION_POINTS_KEY
    mockSelectOnce([{ value: 1 }])   // REGISTRATION_BONUS_ENABLED_KEY
    mockSelectOnce([{ id: "u1" }])   // getUserByEmail

    const { applyDefaultPointsToNewUser } = await import("@/features/points/db/points")
    await applyDefaultPointsToNewUser("new@example.com")

    expect(transaction).toHaveBeenCalledTimes(1)
    // Neither op should hit the top-level db directly — only through the tx.
    expect(update).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it("creditDefaultRegistrationPointsToUser writes the balance and ledger row inside one db.transaction", async () => {
    mockSelectOnce([{ value: 100 }]) // DEFAULT_REGISTRATION_POINTS_KEY

    const { creditDefaultRegistrationPointsToUser } = await import("@/features/points/db/points")
    const result = await creditDefaultRegistrationPointsToUser("u1")

    expect(result).toEqual({ pointsAdded: 100 })
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(update).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it("creditDefaultRegistrationPointsToUser skips the transaction entirely when configured amount is 0", async () => {
    mockSelectOnce([{ value: 0 }])

    const { creditDefaultRegistrationPointsToUser } = await import("@/features/points/db/points")
    const result = await creditDefaultRegistrationPointsToUser("u1")

    expect(result).toEqual({ pointsAdded: 0 })
    expect(transaction).not.toHaveBeenCalled()
  })
})
