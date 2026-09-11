import { describe, expect, it } from "vitest"
import { PRODUCT_SHAPES, productShapeSchema } from "@/features/products/schemas/gemstone-spec"

describe("productShapeSchema", () => {
  // Validates Mixed Cushion and Star appear in the shared shape enum used by create/edit forms.
  it("accepts Mixed Cushion and Star", () => {
    expect(productShapeSchema.parse("Mixed Cushion")).toBe("Mixed Cushion")
    expect(productShapeSchema.parse("Star")).toBe("Star")
  })

  // Validates dropdown source list includes the new values after Cushion.
  it("lists Mixed Cushion and Star after Cushion", () => {
    expect(PRODUCT_SHAPES).toEqual([
      "Oval",
      "Cushion",
      "Mixed Cushion",
      "Star",
      "Round",
      "Pear",
      "Heart",
    ])
  })
})
