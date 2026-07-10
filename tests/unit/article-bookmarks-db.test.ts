import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/drizzle/db"
import {
  addArticleBookmark,
  removeArticleBookmark,
  isArticleBookmarked,
  listArticleBookmarks,
  articleExistsById,
} from "@/features/bookmarks/db/article-bookmarks"

vi.mock("@/drizzle/schema/user-bookmark-article-schema", () => ({
  userBookmarkArticle: {
    id: "id",
    userId: "user_id",
    articleId: "article_id",
    createdAt: "created_at",
  },
}))
vi.mock("@/drizzle/schema/articles-schema", () => ({
  articles: {
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
const ARTICLE_ID = "00000000-0000-4000-8000-000000000002"

describe("article bookmark db helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("isArticleBookmarked returns true when a row is found", async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([{ id: "bm-2" }]) as never)
    await expect(isArticleBookmarked(USER_ID, ARTICLE_ID)).resolves.toBe(true)
  })

  it("isArticleBookmarked returns false when no row is found", async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never)
    await expect(isArticleBookmarked(USER_ID, ARTICLE_ID)).resolves.toBe(false)
  })

  it("articleExistsById returns true when the article row exists", async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([{ id: ARTICLE_ID }]) as never)
    await expect(articleExistsById(ARTICLE_ID)).resolves.toBe(true)
  })

  it("articleExistsById returns false when the article row is missing", async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never)
    await expect(articleExistsById(ARTICLE_ID)).resolves.toBe(false)
  })

  it("addArticleBookmark inserts with the given userId/articleId", async () => {
    const insertMock = insertChain()
    vi.mocked(db.insert).mockReturnValueOnce(insertMock as never)
    await addArticleBookmark(USER_ID, ARTICLE_ID)
    expect(insertMock.values).toHaveBeenCalledWith({ userId: USER_ID, articleId: ARTICLE_ID })
  })

  it("removeArticleBookmark returns true when a row was deleted", async () => {
    vi.mocked(db.delete).mockReturnValueOnce(deleteChain([{ id: "bm-2" }]) as never)
    await expect(removeArticleBookmark(USER_ID, ARTICLE_ID)).resolves.toBe(true)
  })

  it("removeArticleBookmark returns false when no row matched", async () => {
    vi.mocked(db.delete).mockReturnValueOnce(deleteChain([]) as never)
    await expect(removeArticleBookmark(USER_ID, ARTICLE_ID)).resolves.toBe(false)
  })

  it("listArticleBookmarks returns joined items and total", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z")
    vi.mocked(db.select)
      .mockReturnValueOnce(
        selectChain([
          {
            id: "bm-2",
            articleId: ARTICLE_ID,
            createdAt: now,
            title: "Gemstone Identification",
            coverImage: null,
            category: "gemology",
            status: "published",
          },
        ]) as never
      )
      .mockReturnValueOnce(selectChain([{ count: 1 }]) as never)

    const result = await listArticleBookmarks(USER_ID, 1, 10)
    expect(result.total).toBe(1)
    expect(result.items[0]).toMatchObject({
      id: "bm-2",
      articleId: ARTICLE_ID,
      article: { title: "Gemstone Identification", category: "gemology", status: "published" },
    })
  })
})
