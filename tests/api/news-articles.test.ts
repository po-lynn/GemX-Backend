import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import {
  getArticlesPaginatedFromDb,
  getArticleCategoryCountsFromDb,
  getArticleById,
} from "@/features/articles/db/articles"
import { GET as listGET } from "@/app/api/news-articles/route"
import { GET as detailGET } from "@/app/api/news-articles/[id]/route"
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
  title: "Market flash",
  slug: "market-flash",
  language: "English",
  titleEn: "Market flash",
  titleMy: null,
  titleTh: "ข่าวตลาด",
  titleKo: null,
  content: JSON.stringify([
    { type: "paragraph", content: [{ type: "text", text: "Short body." }] },
  ]),
  contentEn: JSON.stringify([
    { type: "paragraph", content: [{ type: "text", text: "Short body." }] },
  ]),
  contentMy: null,
  contentTh: null,
  contentKo: null,
  author: "Gem X Newsroom",
  type: "news",
  category: "market",
  coverImage: null,
  isFeatured: true,
  status: "published",
  publishDate: new Date("2026-05-20"),
  createdAt: new Date("2026-05-18"),
  updatedAt: new Date("2026-05-20"),
}

describe("GET /api/news-articles", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getArticlesPaginatedFromDb).mockResolvedValue({ items: [articleRow], total: 1 })
    vi.mocked(getArticleCategoryCountsFromDb).mockResolvedValue({ all: 1, market: 1 })
  })

  // Validates unified list shape from the articles table (News & Articles menu data).
  it("returns articles with type, readTime, and categoryCounts", async () => {
    const req = new Request("http://localhost/api/news-articles")
    const res = await listGET(req as NextRequest)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.total).toBe(1)
    expect(data.categoryCounts).toEqual({ all: 1, market: 1 })
    expect(data.articles[0].type).toBe("news")
    expect(data.articles[0].readTime).toBe(1)
  })

  // Validates ?type=news|article is forwarded to the articles DB layer.
  it("passes type filter to getArticlesPaginatedFromDb", async () => {
    const req = new Request("http://localhost/api/news-articles?type=news")
    await listGET(req as NextRequest)
    expect(getArticlesPaginatedFromDb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "news",
        status: "published",
        sort: "publish",
      }),
    )
  })

  // Validates search/category/featured + lang still work like /api/articles.
  it("passes search, category, featured and localizes title", async () => {
    const req = new Request(
      "http://localhost/api/news-articles?search=market&category=market&featured=true&lang=Thai",
    )
    const res = await listGET(req as NextRequest)
    expect(getArticlesPaginatedFromDb).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "market",
        category: "market",
        featured: true,
      }),
    )
    const data = await res.json()
    expect(data.articles[0].title).toBe("ข่าวตลาด")
  })

  it("returns 500 when the db throws", async () => {
    vi.mocked(getArticlesPaginatedFromDb).mockRejectedValue(new Error("boom"))
    const req = new Request("http://localhost/api/news-articles")
    const res = await listGET(req as NextRequest)
    expect(res.status).toBe(500)
    expect(await res.json()).toHaveProperty("error", "Failed to fetch news articles")
  })
})

describe("GET /api/news-articles/[id]", () => {
  beforeEach(() => {
    vi.mocked(getArticleById).mockResolvedValue(articleRow)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })

  const params = (id: string) => ({ params: Promise.resolve({ id }) })

  it("returns the published item with readTime and type", async () => {
    const req = new Request(`http://localhost/api/news-articles/${articleRow.id}`)
    const res = await detailGET(req as NextRequest, params(articleRow.id))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.type).toBe("news")
    expect(data.readTime).toBe(1)
    expect(data.isBookmarked).toBe(false)
  })

  it("returns 404 for drafts", async () => {
    vi.mocked(getArticleById).mockResolvedValue({ ...articleRow, status: "draft" })
    const req = new Request(`http://localhost/api/news-articles/${articleRow.id}`)
    const res = await detailGET(req as NextRequest, params(articleRow.id))
    expect(res.status).toBe(404)
  })

  it("returns isBookmarked true with no-store when authenticated and bookmarked", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-abc" } } as never)
    vi.mocked(isArticleBookmarked).mockResolvedValue(true)
    const req = new Request(`http://localhost/api/news-articles/${articleRow.id}`)
    const res = await detailGET(req as NextRequest, params(articleRow.id))
    const data = await res.json()
    expect(data.isBookmarked).toBe(true)
    expect(res.headers.get("Cache-Control")).toBe("no-store")
  })
})
