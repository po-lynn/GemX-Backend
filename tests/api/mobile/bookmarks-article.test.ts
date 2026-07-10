import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { DELETE, GET, POST } from "@/app/api/mobile/bookmarks/article/route"
import { auth } from "@/lib/auth"
import {
  addArticleBookmark,
  removeArticleBookmark,
  listArticleBookmarks,
  articleExistsById,
} from "@/features/bookmarks/db/article-bookmarks"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/bookmarks/db/article-bookmarks", () => ({
  addArticleBookmark: vi.fn(),
  removeArticleBookmark: vi.fn(),
  listArticleBookmarks: vi.fn(),
  articleExistsById: vi.fn(),
}))

const SESSION = { user: { id: "user-abc" } }
const ARTICLE_ID = "00000000-0000-4000-8000-000000000002"

describe("mobile article bookmarks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })

  it("POST returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/api/mobile/bookmarks/article", {
      method: "POST",
      body: JSON.stringify({ articleId: ARTICLE_ID }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(401)
  })

  it("POST returns 400 on invalid body", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const req = new Request("http://localhost/api/mobile/bookmarks/article", {
      method: "POST",
      body: JSON.stringify({ articleId: "not-a-uuid" }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
  })

  it("POST returns 404 when article does not exist", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(articleExistsById).mockResolvedValue(false)
    const req = new Request("http://localhost/api/mobile/bookmarks/article", {
      method: "POST",
      body: JSON.stringify({ articleId: ARTICLE_ID }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: "Article not found" })
  })

  it("POST returns 200 and saves the bookmark", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(articleExistsById).mockResolvedValue(true)
    const req = new Request("http://localhost/api/mobile/bookmarks/article", {
      method: "POST",
      body: JSON.stringify({ articleId: ARTICLE_ID }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, articleId: ARTICLE_ID })
    expect(addArticleBookmark).toHaveBeenCalledWith("user-abc", ARTICLE_ID)
  })

  it("GET returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/api/mobile/bookmarks/article")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(401)
  })

  it("GET returns a paginated list of bookmarks", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(listArticleBookmarks).mockResolvedValue({
      items: [
        {
          id: "bm-2",
          articleId: ARTICLE_ID,
          createdAt: new Date("2026-01-01"),
          article: {
            id: ARTICLE_ID,
            title: "Gemstone Identification",
            coverImage: null,
            category: "gemology",
            status: "published",
          },
        },
      ],
      total: 1,
    })
    const req = new Request("http://localhost/api/mobile/bookmarks/article?page=1&limit=10")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ total: 1, page: 1, limit: 10 })
    expect(body.bookmarks[0]).toMatchObject({ id: "bm-2", articleId: ARTICLE_ID })
    expect(listArticleBookmarks).toHaveBeenCalledWith("user-abc", 1, 10)
  })

  it("DELETE returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/api/mobile/bookmarks/article", {
      method: "DELETE",
      body: JSON.stringify({ articleId: ARTICLE_ID }),
    })
    const res = await DELETE(req as NextRequest)
    expect(res.status).toBe(401)
  })

  it("DELETE returns removed:true when a row was deleted", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(removeArticleBookmark).mockResolvedValue(true)
    const req = new Request("http://localhost/api/mobile/bookmarks/article", {
      method: "DELETE",
      body: JSON.stringify({ articleId: ARTICLE_ID }),
    })
    const res = await DELETE(req as NextRequest)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, articleId: ARTICLE_ID, removed: true })
  })

  it("DELETE returns removed:false when no row matched", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(removeArticleBookmark).mockResolvedValue(false)
    const req = new Request("http://localhost/api/mobile/bookmarks/article", {
      method: "DELETE",
      body: JSON.stringify({ articleId: ARTICLE_ID }),
    })
    const res = await DELETE(req as NextRequest)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ removed: false })
  })
})
