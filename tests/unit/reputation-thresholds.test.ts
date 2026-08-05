import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => "eq"),
}))

vi.mock("@/drizzle/schema/reputation-schema", () => ({
  reputationThreshold: {
    id: "id",
    label: "label",
    logicDescription: "logic_description",
    enabled: "enabled",
    sortOrder: "sort_order",
    dataAvailable: "data_available",
  },
}))

vi.mock("@/drizzle/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}))

import { db } from "@/drizzle/db"
import {
  ensureThresholdsSeeded,
  getThresholds,
  getEnabledThresholdIds,
} from "@/features/reviews/db/reputation-thresholds"

describe("ensureThresholdsSeeded", () => {
  beforeEach(() => vi.clearAllMocks())

  it("inserts the 6 default rules with onConflictDoNothing", async () => {
    const onConflictDoNothingMock = vi.fn().mockResolvedValue(undefined)
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock })
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as never)

    await ensureThresholdsSeeded()

    expect(db.insert).toHaveBeenCalledTimes(1)
    const inserted = valuesMock.mock.calls[0][0] as Array<{ id: string }>
    expect(inserted).toHaveLength(6)
    expect(inserted.map((r) => r.id)).toEqual([
      "rating_below_archive",
      "negative_streak",
      "tag_concentration",
      "non_delivery_reports",
      "positive_burst",
      "auto_archive",
    ])
    expect(onConflictDoNothingMock).toHaveBeenCalledWith({ target: "id" })
  })
})

describe("getThresholds", () => {
  beforeEach(() => vi.clearAllMocks())

  it("seeds then returns rows ordered by sortOrder", async () => {
    const onConflictDoNothingMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock }),
    } as never)

    const rows = [
      { id: "rating_below_archive", enabled: true, dataAvailable: true, sortOrder: 1, label: "x", logicDescription: "y" },
      { id: "non_delivery_reports", enabled: false, dataAvailable: false, sortOrder: 4, label: "x", logicDescription: "y" },
    ]
    const orderByMock = vi.fn().mockResolvedValue(rows)
    const fromMock = vi.fn().mockReturnValue({ orderBy: orderByMock })
    vi.mocked(db.select).mockReturnValue({ from: fromMock } as never)

    const result = await getThresholds()

    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(result).toEqual(rows)
  })
})

describe("getEnabledThresholdIds", () => {
  beforeEach(() => vi.clearAllMocks())

  it("excludes rules that are disabled or lack data", async () => {
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }),
    } as never)
    const rows = [
      { id: "rating_below_archive", enabled: true, dataAvailable: true, sortOrder: 1, label: "x", logicDescription: "y" },
      { id: "non_delivery_reports", enabled: false, dataAvailable: false, sortOrder: 4, label: "x", logicDescription: "y" },
      { id: "auto_archive", enabled: false, dataAvailable: true, sortOrder: 6, label: "x", logicDescription: "y" },
    ]
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(rows) }),
    } as never)

    const ids = await getEnabledThresholdIds()

    expect(ids.has("rating_below_archive")).toBe(true)
    expect(ids.has("non_delivery_reports")).toBe(false)
    expect(ids.has("auto_archive")).toBe(false)
  })
})
