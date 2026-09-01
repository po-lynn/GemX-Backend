import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/features/points/db/points", () => ({
  creditUserPoints: vi.fn(),
  logPointTransaction: vi.fn(),
}))

vi.mock("@/features/points/services/notify-monthly-bonus", () => ({
  notifyMonthlyBonusGranted: vi.fn().mockResolvedValue(undefined),
}))

import {
  addUtcDays,
  buildMonthlyBonusSchedule,
  dueMonthlyBonusCycles,
  grantDueMonthlyBonusPoints,
  monthlyBonusReferenceId,
  utcDayDiff,
} from "@/features/points/db/monthly-bonus"
import { creditUserPoints, logPointTransaction } from "@/features/points/db/points"
import { notifyMonthlyBonusGranted } from "@/features/points/services/notify-monthly-bonus"
import { db } from "@/drizzle/db"

describe("monthly bonus schedule helpers", () => {
  it("adds 30 UTC days between cycles", () => {
    expect(addUtcDays("2023-10-01", 30)).toBe("2023-10-31")
    expect(addUtcDays("2023-10-01", 60)).toBe("2023-11-30")
  })

  it("computes utc day differences", () => {
    expect(utcDayDiff("2023-10-01", "2023-10-01")).toBe(0)
    expect(utcDayDiff("2023-10-01", "2023-10-31")).toBe(30)
  })

  it("builds a schedule of N cycles from start date", () => {
    const schedule = buildMonthlyBonusSchedule("2023-10-01", 6, 100)
    expect(schedule).toHaveLength(6)
    expect(schedule[0]).toMatchObject({
      cycle: 1,
      dueDate: "2023-10-01",
      points: 100,
    })
    expect(schedule[1]?.dueDate).toBe("2023-10-31")
    expect(schedule[5]?.cycle).toBe(6)
  })

  it("returns due cycles including catch-up for past due dates", () => {
    // Day 0 → cycle 1; day 30 → cycles 1–2; day 89 → cycles 1–3
    expect(dueMonthlyBonusCycles("2023-10-01", 6, "2023-09-30")).toEqual([])
    expect(dueMonthlyBonusCycles("2023-10-01", 6, "2023-10-01")).toEqual([1])
    expect(dueMonthlyBonusCycles("2023-10-01", 6, "2023-10-31")).toEqual([1, 2])
    expect(dueMonthlyBonusCycles("2023-10-01", 3, "2024-12-01")).toEqual([1, 2, 3])
  })

  it("builds stable per-cycle reference ids", () => {
    expect(monthlyBonusReferenceId("2023-10-01", 2)).toBe("mb:2023-10-01:c2")
  })
})

describe("grantDueMonthlyBonusPoints", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockSettingsRows(rows: Array<{ key: string; value: number; valueText: string | null }>) {
    // getMonthlyBonusSettings → select().from().where()
    const where = vi.fn().mockResolvedValue(rows)
    const from = vi.fn().mockReturnValue({ where })
    vi.mocked(db.select).mockReturnValue({ from } as never)
    return { where, from }
  }

  it("skips when program is disabled", async () => {
    mockSettingsRows([
      { key: "monthly_bonus_enabled", value: 0, valueText: null },
      { key: "monthly_bonus_amount", value: 100, valueText: null },
      { key: "monthly_bonus_cycles", value: 6, valueText: null },
      { key: "monthly_bonus_start_date", value: 0, valueText: "2023-10-01" },
    ])
    const result = await grantDueMonthlyBonusPoints(new Date("2023-10-01T12:00:00Z"))
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe("disabled")
    expect(creditUserPoints).not.toHaveBeenCalled()
  })

  it("credits eligible users for due cycle 1 and logs monthly_bonus transactions", async () => {
    // Settings query, then usersAlreadyGranted, then listEligibleUserIds
    const settingsWhere = vi.fn().mockResolvedValue([
      { key: "monthly_bonus_enabled", value: 1, valueText: null },
      { key: "monthly_bonus_amount", value: 100, valueText: null },
      { key: "monthly_bonus_cycles", value: 6, valueText: null },
      { key: "monthly_bonus_start_date", value: 0, valueText: "2023-10-01" },
    ])
    const grantedWhere = vi.fn().mockResolvedValue([])
    const eligibleWhere = vi.fn().mockResolvedValue([{ id: "u1" }, { id: "u2" }])

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: settingsWhere }) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: grantedWhere }) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: eligibleWhere }) } as never)

    vi.mocked(creditUserPoints).mockResolvedValue({ success: true, updatedPoints: 200 })
    vi.mocked(logPointTransaction).mockResolvedValue({ id: "tx1" })

    const result = await grantDueMonthlyBonusPoints(new Date("2023-10-01T12:00:00Z"))

    expect(result.skipped).toBe(false)
    expect(result.cyclesProcessed).toEqual([1])
    expect(result.usersCredited).toBe(2)
    expect(creditUserPoints).toHaveBeenCalledTimes(2)
    expect(logPointTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        type: "monthly_bonus",
        direction: "credit",
        amount: 100,
        status: "completed",
        referenceId: "mb:2023-10-01:c1",
        referenceType: "monthly_bonus",
      }),
    )
    expect(notifyMonthlyBonusGranted).toHaveBeenCalledTimes(2)
    expect(notifyMonthlyBonusGranted).toHaveBeenCalledWith({
      userId: "u1",
      amount: 100,
    })
    expect(notifyMonthlyBonusGranted).toHaveBeenCalledWith({
      userId: "u2",
      amount: 100,
    })
  })
})
