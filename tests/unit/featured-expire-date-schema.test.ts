import { describe, it, expect } from "vitest"
import { productUpdateSchema } from "@/features/products/schemas/products"

const BASE = { productId: "a1b2c3d4-e5f6-4789-a012-345678901234" }

describe("productUpdateSchema — featuredExpiresAt", () => {
  it("coerces a YYYY-MM-DD string to a Date", () => {
    const out = productUpdateSchema.parse({ ...BASE, featuredExpiresAt: "2026-07-19" })
    // Zod coerces the string to a Date object
    expect(out.featuredExpiresAt).toBeInstanceOf(Date)
    expect(out.featuredExpiresAt?.toISOString().slice(0, 10)).toBe("2026-07-19")
  })

  it("accepts null (indefinite featured)", () => {
    const out = productUpdateSchema.parse({ ...BASE, featuredExpiresAt: null })
    expect(out.featuredExpiresAt).toBeNull()
  })

  it("treats missing field as undefined (field not updated)", () => {
    const out = productUpdateSchema.parse({ ...BASE })
    expect(out.featuredExpiresAt).toBeUndefined()
  })

  it("treats empty string as null", () => {
    const out = productUpdateSchema.parse({ ...BASE, featuredExpiresAt: "" })
    expect(out.featuredExpiresAt).toBeNull()
  })
})
