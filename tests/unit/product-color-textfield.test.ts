import { describe, it, expect } from "vitest"
import { productCreateSchema, productUpdateSchema } from "@/features/products/schemas/products"

const VALID_CATEGORY_ID = "00000000-0000-4000-8000-000000000001"

const baseLooseStone = {
  title: "Ruby",
  price: "100",
  productType: "loose_stone" as const,
  categoryId: VALID_CATEGORY_ID,
  weightCarat: "1",
  origin: "Myanmar",
}

describe("product color field — plain text only (no colorId)", () => {
  // Loose stones still require a color, now satisfied only by the free-text field.
  it("rejects a loose stone with no color", () => {
    const result = productCreateSchema.safeParse(baseLooseStone)
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "color")
      expect(issue?.message).toBe("Color is required for loose stone")
    }
  })

  it("rejects a loose stone with a blank color string", () => {
    const result = productCreateSchema.safeParse({ ...baseLooseStone, color: "   " })
    expect(result.success).toBe(false)
  })

  it("accepts a loose stone with a plain color string", () => {
    const result = productCreateSchema.safeParse({ ...baseLooseStone, color: "Pigeon Blood Red" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.color).toBe("Pigeon Blood Red")
    }
  })

  // colorId is no longer part of the schema; any such input is simply ignored,
  // not validated or persisted.
  it("ignores a stray colorId field instead of validating it", () => {
    const result = productCreateSchema.safeParse({
      ...baseLooseStone,
      color: "Blue",
      colorId: "not-a-uuid",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty("colorId")
    }
  })

  it("productUpdateSchema accepts a partial update with just color", () => {
    const result = productUpdateSchema.safeParse({
      productId: "a1b2c3d4-e5f6-4789-a012-345678901234",
      color: "Emerald Green",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.color).toBe("Emerald Green")
    }
  })
})
