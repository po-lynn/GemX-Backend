import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import {
  getNewsPaginatedFromDb,
  getNewsCategoryCountsFromDb,
  getNewsById,
} from "@/features/news/db/news"
import { GET as listGET } from "@/app/api/news/route"
import { GET as detailGET } from "@/app/api/news/[id]/route"
import { auth } from "@/lib/auth"
import { isNewsBookmarked } from "@/features/bookmarks/db/news-bookmarks"

vi.mock("next/server", () => ({
  connection: vi.fn(),
}))
vi.mock("@/features/news/db/news", () => ({
  getNewsPaginatedFromDb: vi.fn(),
  getNewsCategoryCountsFromDb: vi.fn(),
  getNewsById: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/bookmarks/db/news-bookmarks", () => ({
  isNewsBookmarked: vi.fn(),
}))

const words = Array.from({ length: 450 }, (_, i) => `word${i}`).join(" ")
const newsRow = {
  id: "3f8a2b1c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
  title: "Market update",
  content: JSON.stringify([{ type: "paragraph", content: [{ type: "text", text: words }] }]),
  author: "Gem X Newsroom",
  category: "market",
  coverImage: "https://cdn.example.com/cover.jpg",
  isFeatured: true,
  status: "published",
  publish: new Date("2026-06-05"),
  createdAt: new Date("2026-06-01"),
  updatedAt: new Date("2026-06-05"),
}

describe("GET /api/news", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getNewsPaginatedFromDb).mockResolvedValue({ items: [newsRow], total: 1 })
    vi.mocked(getNewsCategoryCountsFromDb).mockResolvedValue({ all: 9, market: 4, gemology: 3, guides: 2 })
  })

  // Validates the mobile list response shape: items with readTime + categoryCounts for chips
  it("returns news with computed readTime and category counts", async () => {
    const req = new Request("http://localhost/api/news")
    const res = await listGET(req as NextRequest)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.total).toBe(1)
    expect(data.categoryCounts).toEqual({ all: 9, market: 4, gemology: 3, guides: 2 })
    // 450 words at 200 wpm → 3 minutes
    expect(data.news[0].readTime).toBe(3)
    expect(data.news[0].category).toBe("market")
    expect(data.news[0].isFeatured).toBe(true)
  })

  // Validates search/category/featured params are forwarded to the db layer
  it("passes search, category and featured filters to the query", async () => {
    const req = new Request(
      "http://localhost/api/news?search=ruby&category=market&featured=true&page=2&limit=5"
    )
    await listGET(req as NextRequest)
    expect(getNewsPaginatedFromDb).toHaveBeenCalledWith({
      page: 2,
      limit: 5,
      status: "published",
      search: "ruby",
      category: "market",
      featured: true,
      sort: "publish",
    })
  })

  // Validates invalid query params fall back to defaults instead of erroring
  it("falls back to defaults on invalid query params", async () => {
    const req = new Request("http://localhost/api/news?page=-1&category=bogus")
    const res = await listGET(req as NextRequest)
    expect(res.status).toBe(200)
    expect(getNewsPaginatedFromDb).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20, category: undefined })
    )
  })

  // Validates the error envelope when the db layer throws
  it("returns 500 when the db throws", async () => {
    vi.mocked(getNewsPaginatedFromDb).mockRejectedValue(new Error("boom"))
    const req = new Request("http://localhost/api/news")
    const res = await listGET(req as NextRequest)
    expect(res.status).toBe(500)
    expect(await res.json()).toHaveProperty("error", "Failed to fetch news")
  })
})

describe("GET /api/news/[id]", () => {
  beforeEach(() => {
    vi.mocked(getNewsById).mockResolvedValue(newsRow)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })

  const params = (id: string) => ({ params: Promise.resolve({ id }) })

  // Validates the detail response includes readTime for the header ("6 min")
  it("returns the news item with readTime", async () => {
    const req = new Request(`http://localhost/api/news/${newsRow.id}`)
    const res = await detailGET(req as NextRequest, params(newsRow.id))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.readTime).toBe(3)
    expect(data.author).toBe("Gem X Newsroom")
    expect(data.coverImage).toBe("https://cdn.example.com/cover.jpg")
  })

  // Validates drafts are hidden from the public endpoint
  it("returns 404 for unpublished news", async () => {
    vi.mocked(getNewsById).mockResolvedValue({ ...newsRow, status: "draft" })
    const req = new Request(`http://localhost/api/news/${newsRow.id}`)
    const res = await detailGET(req as NextRequest, params(newsRow.id))
    expect(res.status).toBe(404)
  })

  // Validates missing rows return 404
  it("returns 404 when news does not exist", async () => {
    vi.mocked(getNewsById).mockResolvedValue(null)
    const req = new Request("http://localhost/api/news/missing")
    const res = await detailGET(req as NextRequest, params("missing"))
    expect(res.status).toBe(404)
  })

  // Validates anonymous requests get isBookmarked:false and keep the public/CDN cache header
  it("returns isBookmarked false with public cache headers when unauthenticated", async () => {
    const req = new Request(`http://localhost/api/news/${newsRow.id}`)
    const res = await detailGET(req as NextRequest, params(newsRow.id))
    const data = await res.json()
    expect(data.isBookmarked).toBe(false)
    expect(res.headers.get("Cache-Control")).toContain("public")
  })

  // Validates a signed-in user who bookmarked the item sees isBookmarked:true, and the
  // response is no-store since it is now personalized
  it("returns isBookmarked true with no-store headers for an authenticated bookmarking user", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-abc" } } as never)
    vi.mocked(isNewsBookmarked).mockResolvedValue(true)
    const req = new Request(`http://localhost/api/news/${newsRow.id}`)
    const res = await detailGET(req as NextRequest, params(newsRow.id))
    const data = await res.json()
    expect(data.isBookmarked).toBe(true)
    expect(res.headers.get("Cache-Control")).toBe("no-store")
    expect(isNewsBookmarked).toHaveBeenCalledWith("user-abc", newsRow.id)
  })

  // Validates a signed-in user who has not bookmarked the item sees isBookmarked:false,
  // still with no-store (the response is personalized either way)
  it("returns isBookmarked false with no-store headers for an authenticated non-bookmarking user", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-abc" } } as never)
    vi.mocked(isNewsBookmarked).mockResolvedValue(false)
    const req = new Request(`http://localhost/api/news/${newsRow.id}`)
    const res = await detailGET(req as NextRequest, params(newsRow.id))
    const data = await res.json()
    expect(data.isBookmarked).toBe(false)
    expect(res.headers.get("Cache-Control")).toBe("no-store")
  })
})
