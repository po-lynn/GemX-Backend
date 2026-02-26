import { describe, it, expect } from "vitest"
import { adminProductsSearchSchema } from "@/features/products/schemas/products"

describe("adminProductsSearchSchema", () => {
  it("defaults page to 1 when missing", () => {
    const out = adminProductsSearchSchema.parse({})
    expect(out.page).toBe(1)
  })

  it("coerces page from string", () => {
    const out = adminProductsSearchSchema.parse({ page: "2" })
    expect(out.page).toBe(2)
  })

  it("accepts valid productType", () => {
    expect(adminProductsSearchSchema.parse({ productType: "loose_stone" }).productType).toBe("loose_stone")
    expect(adminProductsSearchSchema.parse({ productType: "jewellery" }).productType).toBe("jewellery")
  })

  it("accepts valid status", () => {
    const out = adminProductsSearchSchema.parse({ status: "active" })
    expect(out.status).toBe("active")
  })

  it("accepts valid optional categoryId UUID", () => {
    const uuid = "a1b2c3d4-e5f6-4789-a012-345678901234"
    const out = adminProductsSearchSchema.parse({ categoryId: uuid })
    expect(out.categoryId).toBe(uuid)
  })

  it("transforms invalid categoryId to undefined", () => {
    const out = adminProductsSearchSchema.parse({ categoryId: "not-a-uuid" })
    expect(out.categoryId).toBeUndefined()
  })

  it("accepts valid shape from productShapeSchema", () => {
    const out = adminProductsSearchSchema.parse({ shape: "Round" })
    expect(out.shape).toBe("Round")
  })

  it("rejects invalid shape", () => {
    expect(() =>
      adminProductsSearchSchema.parse({ shape: "InvalidShape" })
    ).toThrow()
  })

  it("rejects page < 1", () => {
    expect(() => adminProductsSearchSchema.parse({ page: 0 })).toThrow()
    expect(() => adminProductsSearchSchema.parse({ page: -1 })).toThrow()
  })
})
