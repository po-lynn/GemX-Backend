import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/drizzle/db"
import {
  addNewsBookmark,
  removeNewsBookmark,
  isNewsBookmarked,
  listNewsBookmarks,
  newsExistsById,
} from "@/features/bookmarks/db/news-bookmarks"

vi.mock("@/drizzle/schema/user-bookmark-news-schema", () => ({
  userBookmarkNews: {
    id: "id",
    userId: "user_id",
    newsId: "news_id",
    createdAt: "created_at",
  },
}))
vi.mock("@/drizzle/schema/news-schema", () => ({
  news: {
    id: "id",
    title: "title",
    coverImage: "cover_image",
    category: "category",
    status: "status",
  },
}))
vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn((_col, val) => `eq:${val}`),
  sql: vi.fn(),
}))
vi.mock("@/drizzle/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), delete: vi.fn() },
}))

function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  for (const m of ["from", "where", "limit", "offset", "orderBy", "innerJoin"]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject)
  chain.catch = (reject: (e: unknown) => unknown) => Promise.resolve(rows).catch(reject)
  return chain
}

function insertChain() {
  return {
    values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }),
  }
}

function deleteChain(rows: unknown[]) {
  const returning = {
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  }
  return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockReturnValue(returning) }) }
}

const USER_ID = "user-abc"
const NEWS_ID = "00000000-0000-4000-8000-000000000001"

describe("news bookmark db helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("isNewsBookmarked returns true when a row is found", async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([{ id: "bm-1" }]) as never)
    await expect(isNewsBookmarked(USER_ID, NEWS_ID)).resolves.toBe(true)
  })

  it("isNewsBookmarked returns false when no row is found", async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never)
    await expect(isNewsBookmarked(USER_ID, NEWS_ID)).resolves.toBe(false)
  })

  it("newsExistsById returns true when the news row exists", async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([{ id: NEWS_ID }]) as never)
    await expect(newsExistsById(NEWS_ID)).resolves.toBe(true)
  })

  it("newsExistsById returns false when the news row is missing", async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never)
    await expect(newsExistsById(NEWS_ID)).resolves.toBe(false)
  })

  it("addNewsBookmark inserts with the given userId/newsId", async () => {
    const insertMock = insertChain()
    vi.mocked(db.insert).mockReturnValueOnce(insertMock as never)
    await addNewsBookmark(USER_ID, NEWS_ID)
    expect(insertMock.values).toHaveBeenCalledWith({ userId: USER_ID, newsId: NEWS_ID })
  })

  it("removeNewsBookmark returns true when a row was deleted", async () => {
    vi.mocked(db.delete).mockReturnValueOnce(deleteChain([{ id: "bm-1" }]) as never)
    await expect(removeNewsBookmark(USER_ID, NEWS_ID)).resolves.toBe(true)
  })

  it("removeNewsBookmark returns false when no row matched", async () => {
    vi.mocked(db.delete).mockReturnValueOnce(deleteChain([]) as never)
    await expect(removeNewsBookmark(USER_ID, NEWS_ID)).resolves.toBe(false)
  })

  it("listNewsBookmarks returns joined items and total", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z")
    vi.mocked(db.select)
      .mockReturnValueOnce(
        selectChain([
          {
            id: "bm-1",
            newsId: NEWS_ID,
            createdAt: now,
            title: "Market update",
            coverImage: null,
            category: "market",
            status: "published",
          },
        ]) as never
      )
      .mockReturnValueOnce(selectChain([{ count: 1 }]) as never)

    const result = await listNewsBookmarks(USER_ID, 1, 10)
    expect(result.total).toBe(1)
    expect(result.items[0]).toMatchObject({
      id: "bm-1",
      newsId: NEWS_ID,
      news: { title: "Market update", category: "market", status: "published" },
    })
  })
})
