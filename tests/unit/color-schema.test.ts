import { describe, it, expect } from "vitest"
import {
  colorCreateSchema,
  colorUpdateSchema,
  colorDeleteSchema,
} from "@/features/colors/schemas/color"

const VALID_UUID = "a1b2c3d4-e5f6-4789-a012-345678901234"

describe("colorCreateSchema", () => {
  // Validates the happy path: a name plus a well-formed hex code parses cleanly.
  it("accepts a valid name and hex code", () => {
    const r = colorCreateSchema.safeParse({ name: "Pigeon Blood Red", hexCode: "#9B111E" })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toEqual({ name: "Pigeon Blood Red", hexCode: "#9B111E" })
  })

  // Validates that hexCode is optional: omitted → defaults to "" (no swatch).
  it("defaults hexCode to empty string when omitted", () => {
    const r = colorCreateSchema.safeParse({ name: "Multi-color" })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.hexCode).toBe("")
  })

  // Validates that an explicit empty hex (colour with no single swatch) is allowed.
  it("accepts an explicit empty hexCode", () => {
    const r = colorCreateSchema.safeParse({ name: "Bi-color", hexCode: "" })
    expect(r.success).toBe(true)
  })

  // Validates hex format enforcement: missing '#' or bad characters are rejected.
  it.each(["9B111E", "#9B111", "#9B111EFF", "#XYZXYZ", "red"])(
    "rejects malformed hex %s",
    (hexCode) => {
      const r = colorCreateSchema.safeParse({ name: "Red", hexCode })
      expect(r.success).toBe(false)
    }
  )

  // Validates name constraints: empty/whitespace-only names are rejected, input is trimmed.
  it("rejects empty and whitespace-only names, trims valid ones", () => {
    expect(colorCreateSchema.safeParse({ name: "" }).success).toBe(false)
    expect(colorCreateSchema.safeParse({ name: "   " }).success).toBe(false)
    const r = colorCreateSchema.safeParse({ name: "  Royal Blue  " })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.name).toBe("Royal Blue")
  })

  // Validates the 100-char cap on names.
  it("rejects names longer than 100 characters", () => {
    const r = colorCreateSchema.safeParse({ name: "x".repeat(101) })
    expect(r.success).toBe(false)
  })
})

describe("colorUpdateSchema", () => {
  // Validates that update requires a UUID id and allows partial fields.
  it("accepts a colorId with only a name change", () => {
    const r = colorUpdateSchema.safeParse({ colorId: VALID_UUID, name: "Teal" })
    expect(r.success).toBe(true)
  })

  // Validates that a malformed id is rejected.
  it("rejects a non-uuid colorId", () => {
    const r = colorUpdateSchema.safeParse({ colorId: "nope", name: "Teal" })
    expect(r.success).toBe(false)
  })
})

describe("colorDeleteSchema", () => {
  // Validates delete input: uuid required.
  it("requires a uuid colorId", () => {
    expect(colorDeleteSchema.safeParse({ colorId: VALID_UUID }).success).toBe(true)
    expect(colorDeleteSchema.safeParse({ colorId: "123" }).success).toBe(false)
  })
})
