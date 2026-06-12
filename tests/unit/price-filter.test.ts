import { describe, it, expect } from "vitest"

// ─── Inline the filterRow logic under test ─────────────────
// (mirrors the switch cases in ProductsListView filterRow prop)

type Row = { currency: "USD" | "MMK"; price: string }

function filterRowPrice(r: Row, filterId: string, vals: string[]): boolean {
  const currency = filterId === "priceUSD" ? "USD" : "MMK"
  if (r.currency !== currency) return false
  const min = vals.find((v) => v.startsWith("min:"))?.substring(4)
  const max = vals.find((v) => v.startsWith("max:"))?.substring(4)
  const p = Number(r.price)
  if (min && p < Number(min)) return false
  if (max && p > Number(max)) return false
  return true
}

// ─── Inline the defaultFilters construction logic ──────────
function buildDefaultPriceFilters(opts: {
  priceMinUSD?: string
  priceMaxUSD?: string
  priceMinMMK?: string
  priceMaxMMK?: string
}): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  if (opts.priceMinUSD || opts.priceMaxUSD) {
    out.priceUSD = [
      ...(opts.priceMinUSD ? [`min:${opts.priceMinUSD}`] : []),
      ...(opts.priceMaxUSD ? [`max:${opts.priceMaxUSD}`] : []),
    ]
  }
  if (opts.priceMinMMK || opts.priceMaxMMK) {
    out.priceMMK = [
      ...(opts.priceMinMMK ? [`min:${opts.priceMinMMK}`] : []),
      ...(opts.priceMaxMMK ? [`max:${opts.priceMaxMMK}`] : []),
    ]
  }
  return out
}

describe("filterRow — priceUSD", () => {
  it("passes USD row within both bounds", () => {
    expect(filterRowPrice({ currency: "USD", price: "500" }, "priceUSD", ["min:100", "max:1000"])).toBe(true)
  })

  it("blocks USD row below min", () => {
    expect(filterRowPrice({ currency: "USD", price: "50" }, "priceUSD", ["min:100"])).toBe(false)
  })

  it("blocks USD row above max", () => {
    expect(filterRowPrice({ currency: "USD", price: "2000" }, "priceUSD", ["max:1000"])).toBe(false)
  })

  it("passes USD row when only min is set and price equals min", () => {
    expect(filterRowPrice({ currency: "USD", price: "100" }, "priceUSD", ["min:100"])).toBe(true)
  })

  it("passes USD row when only max is set and price equals max", () => {
    expect(filterRowPrice({ currency: "USD", price: "1000" }, "priceUSD", ["max:1000"])).toBe(true)
  })

  it("blocks MMK row when filtering by USD", () => {
    expect(filterRowPrice({ currency: "MMK", price: "500" }, "priceUSD", ["min:100", "max:1000"])).toBe(false)
  })
})

describe("filterRow — priceMMK", () => {
  it("passes MMK row within both bounds", () => {
    expect(filterRowPrice({ currency: "MMK", price: "500000" }, "priceMMK", ["min:100000", "max:1000000"])).toBe(true)
  })

  it("blocks MMK row below min", () => {
    expect(filterRowPrice({ currency: "MMK", price: "50000" }, "priceMMK", ["min:100000"])).toBe(false)
  })

  it("blocks USD row when filtering by MMK", () => {
    expect(filterRowPrice({ currency: "USD", price: "500000" }, "priceMMK", ["min:100000"])).toBe(false)
  })
})

describe("buildDefaultPriceFilters", () => {
  it("returns empty object when no price params given", () => {
    expect(buildDefaultPriceFilters({})).toEqual({})
  })

  it("builds priceUSD entry with both bounds", () => {
    expect(buildDefaultPriceFilters({ priceMinUSD: "100", priceMaxUSD: "500" })).toEqual({
      priceUSD: ["min:100", "max:500"],
    })
  })

  it("builds priceUSD entry with min only", () => {
    expect(buildDefaultPriceFilters({ priceMinUSD: "100" })).toEqual({
      priceUSD: ["min:100"],
    })
  })

  it("builds priceMMK entry with max only", () => {
    expect(buildDefaultPriceFilters({ priceMaxMMK: "1000000" })).toEqual({
      priceMMK: ["max:1000000"],
    })
  })

  it("builds both currency entries when all four params given", () => {
    expect(
      buildDefaultPriceFilters({
        priceMinUSD: "100",
        priceMaxUSD: "500",
        priceMinMMK: "100000",
        priceMaxMMK: "500000",
      })
    ).toEqual({
      priceUSD: ["min:100", "max:500"],
      priceMMK: ["min:100000", "max:500000"],
    })
  })
})
