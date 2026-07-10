import { describe, it, expect } from "vitest"
import {
  newsBookmarkBodySchema,
  articleBookmarkBodySchema,
  bookmarkListQuerySchema,
} from "@/features/bookmarks/schemas/bookmark"

const VALID_UUID = "00000000-0000-4000-8000-000000000001"

describe("newsBookmarkBodySchema", () => {
  it("accepts a valid uuid", () => {
    const result = newsBookmarkBodySchema.safeParse({ newsId: VALID_UUID })
    expect(result.success).toBe(true)
  })

  it("rejects a non-uuid string", () => {
    const result = newsBookmarkBodySchema.safeParse({ newsId: "not-a-uuid" })
    expect(result.success).toBe(false)
  })

  it("rejects a missing newsId", () => {
    const result = newsBookmarkBodySchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe("articleBookmarkBodySchema", () => {
  it("accepts a valid uuid", () => {
    const result = articleBookmarkBodySchema.safeParse({ articleId: VALID_UUID })
    expect(result.success).toBe(true)
  })

  it("rejects a non-uuid string", () => {
    const result = articleBookmarkBodySchema.safeParse({ articleId: "not-a-uuid" })
    expect(result.success).toBe(false)
  })
})

describe("bookmarkListQuerySchema", () => {
  it("defaults page to 1 and limit to 10 when omitted", () => {
    const result = bookmarkListQuerySchema.parse({})
    expect(result).toEqual({ page: 1, limit: 10 })
  })

  it("coerces string query params to numbers", () => {
    const result = bookmarkListQuerySchema.parse({ page: "2", limit: "5" })
    expect(result).toEqual({ page: 2, limit: 5 })
  })

  it("rejects a limit above 50", () => {
    const result = bookmarkListQuerySchema.safeParse({ limit: "100" })
    expect(result.success).toBe(false)
  })

  it("rejects a page below 1", () => {
    const result = bookmarkListQuerySchema.safeParse({ page: "0" })
    expect(result.success).toBe(false)
  })
})
