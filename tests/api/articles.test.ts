import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import {
  getArticlesPaginatedFromDb,
  getArticleCategoryCountsFromDb,
  getArticleById,
} from "@/features/articles/db/articles"
import { GET as listGET } from "@/app/api/articles/route"
import { GET as detailGET } from "@/app/api/articles/[id]/route"
import { auth } from "@/lib/auth"
import { isArticleBookmarked } from "@/features/bookmarks/db/article-bookmarks"

vi.mock("next/server", () => ({
  connection: vi.fn(),
}))
vi.mock("@/features/articles/db/articles", () => ({
  getArticlesPaginatedFromDb: vi.fn(),
  getArticleCategoryCountsFromDb: vi.fn(),
  getArticleById: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/bookmarks/db/article-bookmarks", () => ({
  isArticleBookmarked: vi.fn(),
}))

const articleRow = {
  id: "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
  title: "Gemstone Identification: How to Verify Gemstones",
  slug: "gemstone-identification",
  content: JSON.stringify([
    { type: "paragraph", content: [{ type: "text", text: "Short guide body." }] },
  ]),
  author: "Gem X Newsroom",
  category: "gemology",
  coverImage: null,
  isFeatured: false,
  status: "published",
  publishDate: new Date("2026-05-20"),
  createdAt: new Date("2026-05-18"),
  updatedAt: new Date("2026-05-20"),
}

describe("GET /api/articles", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getArticlesPaginatedFromDb).mockResolvedValue({ items: [articleRow], total: 1 })
    vi.mocked(getArticleCategoryCountsFromDb).mockResolvedValue({ all: 2, gemology: 1, guides: 1 })
  })

  // Validates the mobile list response shape for the Articles tab
  it("returns articles with computed readTime and category counts", async () => {
    const req = new Request("http://localhost/api/articles")
    const res = await listGET(req as NextRequest)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.total).toBe(1)
    expect(data.categoryCounts).toEqual({ all: 2, gemology: 1, guides: 1 })
    // Short content still shows a 1-minute floor
    expect(data.articles[0].readTime).toBe(1)
    expect(data.articles[0].category).toBe("gemology")
  })

  // Validates search/category/featured params are forwarded to the db layer
  it("passes search, category and featured filters to the query", async () => {
    const req = new Request(
      "http://localhost/api/articles?search=identification&category=gemology&featured=false"
    )
    await listGET(req as NextRequest)
    expect(getArticlesPaginatedFromDb).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: "published",
      search: "identification",
      category: "gemology",
      featured: false,
      sort: "publish",
    })
  })

  // Validates the error envelope when the db layer throws
  it("returns 500 when the db throws", async () => {
    vi.mocked(getArticlesPaginatedFromDb).mockRejectedValue(new Error("boom"))
    const req = new Request("http://localhost/api/articles")
    const res = await listGET(req as NextRequest)
    expect(res.status).toBe(500)
    expect(await res.json()).toHaveProperty("error", "Failed to fetch articles")
  })
})

describe("GET /api/articles/[id]", () => {
  beforeEach(() => {
    vi.mocked(getArticleById).mockResolvedValue(articleRow)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })

  const params = (id: string) => ({ params: Promise.resolve({ id }) })

  // Validates the detail response includes readTime and the new fields
  it("returns the article with readTime", async () => {
    const req = new Request(`http://localhost/api/articles/${articleRow.id}`)
    const res = await detailGET(req as NextRequest, params(articleRow.id))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.readTime).toBe(1)
    expect(data.category).toBe("gemology")
    expect(data.isFeatured).toBe(false)
  })

  // Validates drafts are hidden from the public endpoint
  it("returns 404 for unpublished articles", async () => {
    vi.mocked(getArticleById).mockResolvedValue({ ...articleRow, status: "draft" })
    const req = new Request(`http://localhost/api/articles/${articleRow.id}`)
    const res = await detailGET(req as NextRequest, params(articleRow.id))
    expect(res.status).toBe(404)
  })

  // Validates anonymous requests get isBookmarked:false and keep the public/CDN cache header
  it("returns isBookmarked false with public cache headers when unauthenticated", async () => {
    const req = new Request(`http://localhost/api/articles/${articleRow.id}`)
    const res = await detailGET(req as NextRequest, params(articleRow.id))
    const data = await res.json()
    expect(data.isBookmarked).toBe(false)
    expect(res.headers.get("Cache-Control")).toContain("public")
  })

  // Validates a signed-in user who bookmarked the item sees isBookmarked:true with no-store
  it("returns isBookmarked true with no-store headers for an authenticated bookmarking user", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-abc" } } as never)
    vi.mocked(isArticleBookmarked).mockResolvedValue(true)
    const req = new Request(`http://localhost/api/articles/${articleRow.id}`)
    const res = await detailGET(req as NextRequest, params(articleRow.id))
    const data = await res.json()
    expect(data.isBookmarked).toBe(true)
    expect(res.headers.get("Cache-Control")).toBe("no-store")
    expect(isArticleBookmarked).toHaveBeenCalledWith("user-abc", articleRow.id)
  })

  // Validates a signed-in user who has not bookmarked the item sees isBookmarked:false, no-store
  it("returns isBookmarked false with no-store headers for an authenticated non-bookmarking user", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-abc" } } as never)
    vi.mocked(isArticleBookmarked).mockResolvedValue(false)
    const req = new Request(`http://localhost/api/articles/${articleRow.id}`)
    const res = await detailGET(req as NextRequest, params(articleRow.id))
    const data = await res.json()
    expect(data.isBookmarked).toBe(false)
    expect(res.headers.get("Cache-Control")).toBe("no-store")
  })
})
