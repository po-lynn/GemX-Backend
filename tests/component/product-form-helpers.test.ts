import { describe, it, expect } from "vitest"

// Pure helper functions extracted from ProductForm for testability

function getGemHue(categoryName?: string | null): number {
  const n = (categoryName ?? "").toLowerCase()
  if (n.includes("ruby") || n.includes("garnet") || n.includes("spinel")) return 0
  if (n.includes("sapphire")) return 220
  if (n.includes("emerald")) return 140
  if (n.includes("amethyst")) return 270
  if (n.includes("topaz") || n.includes("citrine")) return 40
  if (n.includes("aqua") || n.includes("aquamarine")) return 195
  if (n.includes("tourmaline") || n.includes("jade")) return 150
  if (n.includes("diamond")) return 210
  if (n.includes("pearl")) return 200
  return 260
}

function parseDimensions(value: string | null | undefined): [string, string, string] {
  if (!value?.trim()) return ["", "", ""]
  const parts = value.trim().split(/\s*[x×]\s*/i).map((s) => s.trim())
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""]
}

function computePriceBreakdown(price: string, feeRate = 0.08) {
  const p = parseFloat(price) || 0
  if (!p) return null
  const fee = Math.round(p * feeRate)
  return { listPrice: p, fee, payout: p - fee }
}

describe("getGemHue", () => {
  it("returns 0 for ruby", () => expect(getGemHue("Ruby")).toBe(0))
  it("returns 0 for garnet", () => expect(getGemHue("Red Garnet")).toBe(0))
  it("returns 220 for sapphire", () => expect(getGemHue("Blue Sapphire")).toBe(220))
  it("returns 140 for emerald", () => expect(getGemHue("Emerald")).toBe(140))
  it("returns 270 for amethyst", () => expect(getGemHue("Amethyst")).toBe(270))
  it("returns 260 default for unknown category", () => expect(getGemHue("Unknown Stone")).toBe(260))
  it("returns 260 for null", () => expect(getGemHue(null)).toBe(260))
  it("returns 260 for undefined", () => expect(getGemHue(undefined)).toBe(260))
  it("is case-insensitive", () => expect(getGemHue("RUBY")).toBe(0))
})

describe("parseDimensions", () => {
  it("parses x-separated dimensions", () => {
    expect(parseDimensions("10 x 8 x 5")).toEqual(["10", "8", "5"])
  })
  it("parses × (unicode) separated dimensions", () => {
    expect(parseDimensions("10×8×5")).toEqual(["10", "8", "5"])
  })
  it("returns empty strings for null", () => {
    expect(parseDimensions(null)).toEqual(["", "", ""])
  })
  it("returns empty strings for empty string", () => {
    expect(parseDimensions("")).toEqual(["", "", ""])
  })
  it("fills missing parts with empty string", () => {
    expect(parseDimensions("10 x 8")).toEqual(["10", "8", ""])
  })
})

describe("computePriceBreakdown", () => {
  it("returns null for zero price", () => {
    expect(computePriceBreakdown("0")).toBeNull()
    expect(computePriceBreakdown("")).toBeNull()
  })
  it("computes 8% fee and payout", () => {
    const result = computePriceBreakdown("1000")
    expect(result).toEqual({ listPrice: 1000, fee: 80, payout: 920 })
  })
  it("rounds fee to nearest integer", () => {
    const result = computePriceBreakdown("100")
    expect(result?.fee).toBe(8)
  })
})
