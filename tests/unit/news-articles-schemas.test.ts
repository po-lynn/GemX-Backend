import { describe, it, expect } from "vitest"
import {
  newsCreateSchema,
  newsUpdateSchema,
  newsListQuerySchema,
  CONTENT_CATEGORIES,
} from "@/features/news/schemas/news"
import {
  articleCreateSchema,
  articleListQuerySchema,
} from "@/features/articles/schemas/articles"

describe("newsCreateSchema", () => {
  // Validates defaults for the new mobile-design fields
  it("defaults author, category and isFeatured", () => {
    const parsed = newsCreateSchema.parse({ title: "Hello" })
    expect(parsed.author).toBe("Gem X Newsroom")
    expect(parsed.category).toBe("general")
    expect(parsed.isFeatured).toBe(false)
  })

  // Validates that only known categories are accepted
  it("rejects unknown categories", () => {
    const result = newsCreateSchema.safeParse({ title: "Hello", category: "sports" })
    expect(result.success).toBe(false)
  })

  // Validates coverImage must be a URL
  it("rejects non-URL coverImage", () => {
    const result = newsCreateSchema.safeParse({ title: "Hello", coverImage: "not-a-url" })
    expect(result.success).toBe(false)
  })

  // Validates a fully-populated payload
  it("accepts a valid payload with all new fields", () => {
    const parsed = newsCreateSchema.parse({
      title: "Market update",
      category: "market",
      coverImage: "https://cdn.example.com/cover.jpg",
      isFeatured: true,
    })
    expect(parsed.category).toBe("market")
    expect(parsed.coverImage).toBe("https://cdn.example.com/cover.jpg")
    expect(parsed.isFeatured).toBe(true)
  })
})

describe("newsUpdateSchema", () => {
  // Validates partial updates leave new fields undefined (no accidental overwrite)
  it("keeps new fields undefined when omitted", () => {
    const parsed = newsUpdateSchema.parse({
      newsId: "3f8a2b1c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
      title: "Updated",
    })
    expect(parsed.category).toBeUndefined()
    expect(parsed.coverImage).toBeUndefined()
    expect(parsed.isFeatured).toBeUndefined()
  })

  // Validates coverImage can be cleared with null
  it("allows null coverImage to clear the image", () => {
    const parsed = newsUpdateSchema.parse({
      newsId: "3f8a2b1c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
      coverImage: null,
    })
    expect(parsed.coverImage).toBeNull()
  })
})

describe("articleCreateSchema", () => {
  // Validates the article schema picked up the same new fields
  it("defaults category and isFeatured", () => {
    const parsed = articleCreateSchema.parse({ title: "Guide" })
    expect(parsed.category).toBe("general")
    expect(parsed.isFeatured).toBe(false)
  })
})

describe("list query schemas", () => {
  // Validates defaults for a bare mobile list request
  it("defaults to page 1, limit 20, published", () => {
    const parsed = newsListQuerySchema.parse({})
    expect(parsed).toMatchObject({ page: 1, limit: 20, status: "published" })
  })

  // Validates the featured flag string is converted to boolean
  it("transforms featured=true into a boolean", () => {
    const parsed = newsListQuerySchema.parse({ featured: "true" })
    expect(parsed.featured).toBe(true)
    const parsedFalse = articleListQuerySchema.parse({ featured: "false" })
    expect(parsedFalse.featured).toBe(false)
  })

  // Validates invalid values fall back instead of failing the request
  it("falls back on invalid page, category and status", () => {
    const parsed = newsListQuerySchema.parse({
      page: "abc",
      category: "bogus",
      status: "archived",
    })
    expect(parsed.page).toBe(1)
    expect(parsed.category).toBeUndefined()
    expect(parsed.status).toBe("published")
  })

  // Validates limit is clamped to the 100 max
  it("falls back to default limit when above 100", () => {
    const parsed = articleListQuerySchema.parse({ limit: "500" })
    expect(parsed.limit).toBe(20)
  })

  // Validates every design category is present in the enum
  it("supports all design categories", () => {
    expect(CONTENT_CATEGORIES).toEqual(
      expect.arrayContaining(["market", "gemology", "guides", "product", "general"])
    )
  })
})
