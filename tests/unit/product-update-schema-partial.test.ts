import { describe, it, expect } from "vitest"
import { productUpdateSchema } from "@/features/products/schemas/products"

const BASE = { productId: "a1b2c3d4-e5f6-4789-a012-345678901234" }

describe("productUpdateSchema — partial status-only updates", () => {
  // Reproduces: mobile archive/unarchive/sold actions PATCH { status } only,
  // which must not implicitly wipe images/videos or reset currency.
  it("leaves imageUrls undefined when omitted from a status-only update", () => {
    const out = productUpdateSchema.parse({ ...BASE, status: "sold" })
    expect(out.imageUrls).toBeUndefined()
  })

  it("leaves videoUrls undefined when omitted from a status-only update", () => {
    const out = productUpdateSchema.parse({ ...BASE, status: "sold" })
    expect(out.videoUrls).toBeUndefined()
  })

  it("leaves currency undefined (not defaulted to USD) when omitted from a status-only update", () => {
    const out = productUpdateSchema.parse({ ...BASE, status: "sold" })
    expect(out.currency).toBeUndefined()
  })

  it("still parses an explicit imageUrls string into an array when provided", () => {
    const out = productUpdateSchema.parse({ ...BASE, imageUrls: "a.jpg,b.jpg" })
    expect(out.imageUrls).toEqual(["a.jpg", "b.jpg"])
  })

  it("still parses an explicit currency when provided", () => {
    const out = productUpdateSchema.parse({ ...BASE, currency: "MMK" })
    expect(out.currency).toBe("MMK")
  })
})
