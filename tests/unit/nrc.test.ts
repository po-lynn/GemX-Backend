import { describe, it, expect } from "vitest"
import { validateNrc, parseNrc, nrcSchema, generateNrc } from "@/lib/nrc"

describe("validateNrc", () => {
  it("accepts the Latin transliteration format", () => {
    expect(validateNrc("12/ABC(N)123456")).toBe(true)
  })

  it("accepts the Myanmar script format", () => {
    expect(validateNrc("၉/မလန(နိုင်)၁၂၈၂၃၃")).toBe(true)
  })

  it("rejects a plain string", () => {
    expect(validateNrc("PASSPORT123")).toBe(false)
  })

  it("rejects a Latin NRC with a bad citizen-type letter", () => {
    expect(validateNrc("12/ABC(X)123456")).toBe(false)
  })

  it("rejects a Latin NRC with too few township letters", () => {
    expect(validateNrc("12/AB(N)123456")).toBe(false)
  })

  it("rejects mixing Latin digits with Myanmar script", () => {
    expect(validateNrc("12/မလန(နိုင်)123456")).toBe(false)
  })

  it("accepts a Myanmar-script NRC with a bare Latin citizen-type letter", () => {
    expect(validateNrc("၉/မလန(N)၁၂၈၂၃၃")).toBe(true)
  })

  it("rejects a Myanmar-script NRC with a bad Latin citizen-type letter", () => {
    expect(validateNrc("၉/မလန(X)၁၂၈၂၃၃")).toBe(false)
  })
})

describe("parseNrc", () => {
  it("parses a Latin NRC into its components", () => {
    expect(parseNrc("12/ABC(N)123456")).toEqual({
      state: 12,
      township: "ABC",
      type: "N",
      serial: "123456",
    })
  })

  it("parses a Myanmar-script NRC into its components", () => {
    expect(parseNrc("၉/မလန(နိုင်)၁၂၈၂၃၃")).toEqual({
      state: 9,
      township: "မလန",
      type: "နိုင်",
      serial: "၁၂၈၂၃၃",
    })
  })

  it("parses a Myanmar-script NRC with a bare Latin citizen-type letter", () => {
    expect(parseNrc("၉/မလန(N)၁၂၈၂၃၃")).toEqual({
      state: 9,
      township: "မလန",
      type: "N",
      serial: "၁၂၈၂၃၃",
    })
  })

  it("returns null for an invalid NRC", () => {
    expect(parseNrc("not-an-nrc")).toBeNull()
  })
})

describe("nrcSchema", () => {
  it("accepts a valid Latin NRC", () => {
    expect(nrcSchema.safeParse("12/ABC(N)123456").success).toBe(true)
  })

  it("accepts a valid Myanmar-script NRC", () => {
    expect(nrcSchema.safeParse("၉/မလန(နိုင်)၁၂၈၂၃၃").success).toBe(true)
  })

  it("rejects an invalid NRC", () => {
    expect(nrcSchema.safeParse("PASSPORT123").success).toBe(false)
  })
})

describe("generateNrc", () => {
  it("generates an NRC that passes validateNrc", () => {
    expect(validateNrc(generateNrc())).toBe(true)
  })
})
