import { describe, it, expect } from "vitest"
import {
  formatPlural,
  formatPrice,
  formatPriceWithCurrency,
  formatNumber,
  formatDate,
} from "@/lib/formatters"

describe("formatPlural", () => {
  it("returns singular with count when count is 1 and includeCount true", () => {
    expect(formatPlural(1, { singular: "item", plural: "items" })).toBe(
      "1 item"
    )
  })
  it("returns plural with count when count is not 1", () => {
    expect(formatPlural(0, { singular: "item", plural: "items" })).toBe(
      "0 items"
    )
    expect(formatPlural(2, { singular: "item", plural: "items" })).toBe(
      "2 items"
    )
  })
  it("omits count when includeCount is false", () => {
    expect(
      formatPlural(1, { singular: "item", plural: "items" }, { includeCount: false })
    ).toBe("item")
    expect(
      formatPlural(5, { singular: "item", plural: "items" }, { includeCount: false })
    ).toBe("items")
  })
})

describe("formatPrice", () => {
  it("formats positive amount as USD", () => {
    expect(formatPrice(10)).toMatch(/\$10(\.00)?/)
    expect(formatPrice(99.5)).toMatch(/\$99\.50/)
  })
  it("returns Free for zero when showZeroAsNumber is false", () => {
    expect(formatPrice(0)).toBe("Free")
  })
  it("formats zero as currency when showZeroAsNumber is true", () => {
    expect(formatPrice(0, { showZeroAsNumber: true })).toMatch(/\$0(\.00)?/)
  })
})

describe("formatPriceWithCurrency", () => {
  it("formats amount in USD by default", () => {
    expect(formatPriceWithCurrency(25)).toMatch(/\$25(\.00)?/)
  })
  it("formats amount in MMK when specified", () => {
    expect(formatPriceWithCurrency(25, "MMK")).toMatch(/25(\.00)?/)
  })
})

describe("formatNumber", () => {
  it("formats number (locale may vary)", () => {
    const s = formatNumber(1000)
    expect(typeof s).toBe("string")
    expect(s).toMatch(/1[\s,.]?000/)
  })
  it("accepts Intl options", () => {
    expect(formatNumber(0.5, { style: "percent" })).toMatch(/50%/)
  })
})

describe("formatDate", () => {
  it("formats a date", () => {
    const d = new Date("2025-02-03T14:30:00Z")
    expect(formatDate(d)).toBeTruthy()
    expect(typeof formatDate(d)).toBe("string")
  })
})
