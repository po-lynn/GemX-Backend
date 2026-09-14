import { describe, it, expect } from "vitest"
import {
  productShapeCreateSchema,
  productShapeUpdateSchema,
  productShapeDeleteSchema,
} from "@/features/product-shape/schemas/product-shape"

describe("productShapeCreateSchema", () => {
  // Accepts a non-empty Product Shape name.
  it("accepts a valid name", () => {
    expect(productShapeCreateSchema.safeParse({ name: "Oval" }).success).toBe(true)
  })

  // Empty name must fail — form label is "Product Shape".
  it("rejects an empty name", () => {
    expect(productShapeCreateSchema.safeParse({ name: "" }).success).toBe(false)
  })
})

describe("productShapeUpdateSchema", () => {
  it("requires a productShapeId uuid", () => {
    expect(
      productShapeUpdateSchema.safeParse({ productShapeId: "not-a-uuid", name: "Round" })
        .success,
    ).toBe(false)
    expect(
      productShapeUpdateSchema.safeParse({
        productShapeId: "00000000-0000-4000-8000-000000000001",
        name: "Round",
      }).success,
    ).toBe(true)
  })
})

describe("productShapeDeleteSchema", () => {
  it("requires a productShapeId uuid", () => {
    expect(productShapeDeleteSchema.safeParse({ productShapeId: "x" }).success).toBe(false)
    expect(
      productShapeDeleteSchema.safeParse({
        productShapeId: "00000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(true)
  })
})
