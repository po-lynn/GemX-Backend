import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { DELETE, GET, POST } from "@/app/api/mobile/bookmarks/news/route"
import { auth } from "@/lib/auth"
import {
  addNewsBookmark,
  removeNewsBookmark,
  listNewsBookmarks,
  newsExistsById,
} from "@/features/bookmarks/db/news-bookmarks"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/bookmarks/db/news-bookmarks", () => ({
  addNewsBookmark: vi.fn(),
  removeNewsBookmark: vi.fn(),
  listNewsBookmarks: vi.fn(),
  newsExistsById: vi.fn(),
}))

const SESSION = { user: { id: "user-abc" } }
const NEWS_ID = "00000000-0000-4000-8000-000000000001"

describe("mobile news bookmarks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })

  it("POST returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/api/mobile/bookmarks/news", {
      method: "POST",
      body: JSON.stringify({ newsId: NEWS_ID }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(401)
  })

  it("POST returns 400 on invalid body", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    const req = new Request("http://localhost/api/mobile/bookmarks/news", {
      method: "POST",
      body: JSON.stringify({ newsId: "not-a-uuid" }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
  })

  it("POST returns 404 when news does not exist", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(newsExistsById).mockResolvedValue(false)
    const req = new Request("http://localhost/api/mobile/bookmarks/news", {
      method: "POST",
      body: JSON.stringify({ newsId: NEWS_ID }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: "News not found" })
  })

  it("POST returns 200 and saves the bookmark", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(newsExistsById).mockResolvedValue(true)
    const req = new Request("http://localhost/api/mobile/bookmarks/news", {
      method: "POST",
      body: JSON.stringify({ newsId: NEWS_ID }),
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, newsId: NEWS_ID })
    expect(addNewsBookmark).toHaveBeenCalledWith("user-abc", NEWS_ID)
  })

  it("GET returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/api/mobile/bookmarks/news")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(401)
  })

  it("GET returns a paginated list of bookmarks", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(listNewsBookmarks).mockResolvedValue({
      items: [
        {
          id: "bm-1",
          newsId: NEWS_ID,
          createdAt: new Date("2026-01-01"),
          news: {
            id: NEWS_ID,
            title: "Market update",
            coverImage: null,
            category: "market",
            status: "published",
          },
        },
      ],
      total: 1,
    })
    const req = new Request("http://localhost/api/mobile/bookmarks/news?page=1&limit=10")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ total: 1, page: 1, limit: 10 })
    expect(body.bookmarks[0]).toMatchObject({ id: "bm-1", newsId: NEWS_ID })
    expect(listNewsBookmarks).toHaveBeenCalledWith("user-abc", 1, 10)
  })

  it("DELETE returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/api/mobile/bookmarks/news", {
      method: "DELETE",
      body: JSON.stringify({ newsId: NEWS_ID }),
    })
    const res = await DELETE(req as NextRequest)
    expect(res.status).toBe(401)
  })

  it("DELETE returns removed:true when a row was deleted", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(removeNewsBookmark).mockResolvedValue(true)
    const req = new Request("http://localhost/api/mobile/bookmarks/news", {
      method: "DELETE",
      body: JSON.stringify({ newsId: NEWS_ID }),
    })
    const res = await DELETE(req as NextRequest)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, newsId: NEWS_ID, removed: true })
  })

  it("DELETE returns removed:false when no row matched", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(SESSION as never)
    vi.mocked(removeNewsBookmark).mockResolvedValue(false)
    const req = new Request("http://localhost/api/mobile/bookmarks/news", {
      method: "DELETE",
      body: JSON.stringify({ newsId: NEWS_ID }),
    })
    const res = await DELETE(req as NextRequest)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ removed: false })
  })
})
