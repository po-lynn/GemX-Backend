import { describe, it, expect } from "vitest"
import { normalizeProductBody } from "@/features/products/api/normalize-product-body"

describe("normalizeProductBody", () => {
  it("returns empty object for null or non-object", () => {
    expect(normalizeProductBody(null)).toEqual({})
    expect(normalizeProductBody(undefined)).toEqual({})
    expect(normalizeProductBody("string")).toEqual({})
    expect(normalizeProductBody(42)).toEqual({})
  })

  it("stringifies jewelleryGemstones array", () => {
    const body = {
      jewelleryGemstones: [{ weightCarat: "1", color: "red" }],
    }
    const out = normalizeProductBody(body)
    expect(out.jewelleryGemstones).toBe(JSON.stringify(body.jewelleryGemstones))
  })

  it("joins imageUrls array with newline", () => {
    const body = { imageUrls: ["https://a.com", "https://b.com"] }
    const out = normalizeProductBody(body)
    expect(out.imageUrls).toBe("https://a.com\nhttps://b.com")
  })

  it("converts numeric price to string", () => {
    const body = { price: 99.99 }
    const out = normalizeProductBody(body)
    expect(out.price).toBe("99.99")
  })

  it("preserves other keys and applies all transformations together", () => {
    const body = {
      title: "Ring",
      price: 100,
      jewelleryGemstones: [],
      imageUrls: ["u1", "u2"],
    }
    const out = normalizeProductBody(body)
    expect(out.title).toBe("Ring")
    expect(out.price).toBe("100")
    expect(out.jewelleryGemstones).toBe("[]")
    expect(out.imageUrls).toBe("u1\nu2")
  })

  it("normalizes product dimensions array to admin-style join", () => {
    const out = normalizeProductBody({
      dimensions: ["8.2mm", "6.5mm", "4mm"],
    })
    expect(out.dimensions).toBe("8.2mm × 6.5mm × 4mm")
  })

  it("normalizes product dimensions object length/width/depth", () => {
    const out = normalizeProductBody({
      dimensions: { length: "8", width: "6", depth: "4" },
    })
    expect(out.dimensions).toBe("8 × 6 × 4")
  })

  it("normalizes dimensions inside jewelleryGemstones before stringify", () => {
    const out = normalizeProductBody({
      jewelleryGemstones: [
        {
          categoryId: "00000000-0000-4000-8000-000000000001",
          weightCarat: "1",
          color: "Red",
          origin: "Myanmar",
          dimensions: ["6mm", "5mm"],
        },
      ],
    })
    const parsed = JSON.parse(String(out.jewelleryGemstones)) as {
      dimensions: string
    }[]
    expect(parsed[0].dimensions).toBe("6mm × 5mm")
  })
})
