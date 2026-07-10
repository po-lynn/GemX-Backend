# News & Article Bookmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the mobile app save/unsave news and articles ("bookmark" icon on the detail screen) and know whether the current item is already bookmarked.

**Architecture:** Two new Drizzle tables (`user_bookmark_news`, `user_bookmark_article`) mirroring the existing `userFavouriteProduct` pattern. A `features/bookmarks/` module holds DB query helpers and Zod schemas for both. Two new mobile routes (`/api/mobile/bookmarks/news`, `/api/mobile/bookmarks/article`) expose POST/GET/DELETE. The existing public detail routes (`/api/news/[id]`, `/api/articles/[id]`) gain an `isBookmarked` field, switching from the shared CDN cache to `no-store` only for authenticated requests (to avoid leaking one user's bookmark state to another via the CDN cache).

**Tech Stack:** Next.js route handlers, Drizzle ORM (PostgreSQL), Zod, Better Auth (`auth.api.getSession`), Vitest.

## Global Constraints

- Zod schemas live in `features/<feature>/schemas/`, not inline in route files.
- **Never run `db:generate`, `db:migrate`, or `db:push`.** The user applies all Drizzle migrations manually. Write the schema files only; do not attempt to generate or apply a migration.
- User's `id` column is `text`, not `uuid` (`drizzle/schema/auth-schema.ts`) — bookmark tables' `userId` FK must be `text`.
- `news.id` and `articles.id` are `uuid` — bookmark tables' `newsId`/`articleId` FK must be `uuid`.
- Mobile auth pattern: `const session = await auth.api.getSession({ headers: request.headers })`; `401` via `jsonError("Unauthorized", 401)` if absent.
- Every route handler: `await connection()` first, wrap body in try/catch, `console.error` + `jsonError(..., 500)` on unexpected failure.
- `jsonCached()` sets `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` (shared/CDN cache) — never put per-user data in a `jsonCached` response.
- After every change: technical doc (`docs/technical/`), collaborator guide (`docs/guides/`), and API docs (`docs/api/`) for any changed/new route — all required by this repo's `CLAUDE.md`.

---

### Task 1: Bookmark schema tables

**Files:**
- Create: `drizzle/schema/user-bookmark-news-schema.ts`
- Create: `drizzle/schema/user-bookmark-article-schema.ts`
- Modify: `drizzle/schema.ts`

**Interfaces:**
- Produces: `userBookmarkNews` (columns: `id`, `userId`, `newsId`, `createdAt`), `userBookmarkArticle` (columns: `id`, `userId`, `articleId`, `createdAt`). Both tables have a unique index on `(userId, <contentId>)`.

- [ ] **Step 1: Create the news bookmark schema**

`drizzle/schema/user-bookmark-news-schema.ts`:

```typescript
import { relations } from "drizzle-orm"
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth-schema"
import { news } from "./news-schema"

/**
 * User-saved news articles (bookmarks) for the mobile "Saved" screen.
 */
export const userBookmarkNews = pgTable(
  "user_bookmark_news",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    newsId: uuid("news_id")
      .notNull()
      .references(() => news.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_bookmark_news_user_news_unique").on(table.userId, table.newsId),
    index("user_bookmark_news_user_id_idx").on(table.userId),
    index("user_bookmark_news_news_id_idx").on(table.newsId),
    index("user_bookmark_news_created_at_idx").on(table.createdAt),
  ]
)

export const userBookmarkNewsRelations = relations(userBookmarkNews, ({ one }) => ({
  user: one(user, {
    fields: [userBookmarkNews.userId],
    references: [user.id],
  }),
  news: one(news, {
    fields: [userBookmarkNews.newsId],
    references: [news.id],
  }),
}))
```

- [ ] **Step 2: Create the article bookmark schema**

`drizzle/schema/user-bookmark-article-schema.ts`:

```typescript
import { relations } from "drizzle-orm"
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth-schema"
import { articles } from "./articles-schema"

/**
 * User-saved articles (bookmarks) for the mobile "Saved" screen.
 */
export const userBookmarkArticle = pgTable(
  "user_bookmark_article",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_bookmark_article_user_article_unique").on(table.userId, table.articleId),
    index("user_bookmark_article_user_id_idx").on(table.userId),
    index("user_bookmark_article_article_id_idx").on(table.articleId),
    index("user_bookmark_article_created_at_idx").on(table.createdAt),
  ]
)

export const userBookmarkArticleRelations = relations(userBookmarkArticle, ({ one }) => ({
  user: one(user, {
    fields: [userBookmarkArticle.userId],
    references: [user.id],
  }),
  article: one(articles, {
    fields: [userBookmarkArticle.articleId],
    references: [articles.id],
  }),
}))
```

- [ ] **Step 3: Export both from the schema index**

In `drizzle/schema.ts`, add after the existing `export * from "./schema/user-favourite-product-schema"` line:

```typescript
export * from "./schema/user-bookmark-news-schema"
export * from "./schema/user-bookmark-article-schema"
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors (pure schema definitions have no behavioral test — this matches `userFavouriteProduct`, which also has no dedicated schema test file).

- [ ] **Step 5: Commit**

```bash
git add drizzle/schema/user-bookmark-news-schema.ts drizzle/schema/user-bookmark-article-schema.ts drizzle/schema.ts
git commit -m "feat: add user_bookmark_news and user_bookmark_article schema tables"
```

**Note for whoever runs migrations:** these two tables need `npm run db:generate` + `npm run db:migrate` before the routes in later tasks will work against a real database. Per this repo's convention, do not run those commands yourself — flag it to the user once the plan is complete.

---

### Task 2: Bookmark Zod schemas

**Files:**
- Create: `features/bookmarks/schemas/bookmark.ts`
- Test: `tests/unit/bookmark-schemas.test.ts`

**Interfaces:**
- Produces: `newsBookmarkBodySchema` (`{ newsId: string }`), `articleBookmarkBodySchema` (`{ articleId: string }`), `bookmarkListQuerySchema` (`{ page: number; limit: number }`, defaults `page=1`, `limit=10`, `limit` capped at 50).

- [ ] **Step 1: Write the failing tests**

`tests/unit/bookmark-schemas.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- bookmark-schemas`
Expected: FAIL — `Cannot find module '@/features/bookmarks/schemas/bookmark'`

- [ ] **Step 3: Write the implementation**

`features/bookmarks/schemas/bookmark.ts`:

```typescript
import { z } from "zod"

export const newsBookmarkBodySchema = z.object({
  newsId: z.string().uuid(),
})

export const articleBookmarkBodySchema = z.object({
  articleId: z.string().uuid(),
})

export const bookmarkListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- bookmark-schemas`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add features/bookmarks/schemas/bookmark.ts tests/unit/bookmark-schemas.test.ts
git commit -m "feat: add bookmark request/query zod schemas"
```

---

### Task 3: News bookmark DB helpers

**Files:**
- Create: `features/bookmarks/db/news-bookmarks.ts`
- Test: `tests/unit/news-bookmarks-db.test.ts`

**Interfaces:**
- Consumes: `userBookmarkNews` (Task 1), `news` table (`drizzle/schema/news-schema.ts`).
- Produces: `newsExistsById(newsId: string): Promise<boolean>`, `addNewsBookmark(userId: string, newsId: string): Promise<void>`, `removeNewsBookmark(userId: string, newsId: string): Promise<boolean>`, `isNewsBookmarked(userId: string, newsId: string): Promise<boolean>`, `listNewsBookmarks(userId: string, page: number, limit: number): Promise<{ items: NewsBookmarkItem[]; total: number }>`, and the `NewsBookmarkItem` type (`{ id, newsId, createdAt, news: { id, title, coverImage, category, status } }`).

- [ ] **Step 1: Write the failing tests**

`tests/unit/news-bookmarks-db.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- news-bookmarks-db`
Expected: FAIL — `Cannot find module '@/features/bookmarks/db/news-bookmarks'`

- [ ] **Step 3: Write the implementation**

`features/bookmarks/db/news-bookmarks.ts`:

```typescript
import { db } from "@/drizzle/db"
import { and, desc, eq, sql } from "drizzle-orm"
import { userBookmarkNews } from "@/drizzle/schema/user-bookmark-news-schema"
import { news } from "@/drizzle/schema/news-schema"

export type NewsBookmarkItem = {
  id: string
  newsId: string
  createdAt: Date
  news: {
    id: string
    title: string
    coverImage: string | null
    category: string
    status: string
  }
}

export async function newsExistsById(newsId: string): Promise<boolean> {
  const [row] = await db.select({ id: news.id }).from(news).where(eq(news.id, newsId)).limit(1)
  return Boolean(row)
}

export async function addNewsBookmark(userId: string, newsId: string): Promise<void> {
  await db
    .insert(userBookmarkNews)
    .values({ userId, newsId })
    .onConflictDoNothing({
      target: [userBookmarkNews.userId, userBookmarkNews.newsId],
    })
}

export async function removeNewsBookmark(userId: string, newsId: string): Promise<boolean> {
  const deleted = await db
    .delete(userBookmarkNews)
    .where(and(eq(userBookmarkNews.userId, userId), eq(userBookmarkNews.newsId, newsId)))
    .returning({ id: userBookmarkNews.id })
  return deleted.length > 0
}

export async function isNewsBookmarked(userId: string, newsId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: userBookmarkNews.id })
    .from(userBookmarkNews)
    .where(and(eq(userBookmarkNews.userId, userId), eq(userBookmarkNews.newsId, newsId)))
    .limit(1)
  return Boolean(row)
}

export async function listNewsBookmarks(
  userId: string,
  page: number,
  limit: number
): Promise<{ items: NewsBookmarkItem[]; total: number }> {
  const offset = (page - 1) * limit

  const rows = await db
    .select({
      id: userBookmarkNews.id,
      newsId: news.id,
      createdAt: userBookmarkNews.createdAt,
      title: news.title,
      coverImage: news.coverImage,
      category: news.category,
      status: news.status,
    })
    .from(userBookmarkNews)
    .innerJoin(news, eq(news.id, userBookmarkNews.newsId))
    .where(eq(userBookmarkNews.userId, userId))
    .orderBy(desc(userBookmarkNews.createdAt))
    .limit(limit)
    .offset(offset)

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userBookmarkNews)
    .where(eq(userBookmarkNews.userId, userId))

  return {
    items: rows.map((r) => ({
      id: r.id,
      newsId: r.newsId,
      createdAt: r.createdAt,
      news: {
        id: r.newsId,
        title: r.title,
        coverImage: r.coverImage,
        category: r.category,
        status: r.status,
      },
    })),
    total: countRows[0]?.count ?? 0,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- news-bookmarks-db`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add features/bookmarks/db/news-bookmarks.ts tests/unit/news-bookmarks-db.test.ts
git commit -m "feat: add news bookmark db query helpers"
```

---

### Task 4: Article bookmark DB helpers

**Files:**
- Create: `features/bookmarks/db/article-bookmarks.ts`
- Test: `tests/unit/article-bookmarks-db.test.ts`

**Interfaces:**
- Consumes: `userBookmarkArticle` (Task 1), `articles` table (`drizzle/schema/articles-schema.ts`).
- Produces: `articleExistsById(articleId: string): Promise<boolean>`, `addArticleBookmark(userId: string, articleId: string): Promise<void>`, `removeArticleBookmark(userId: string, articleId: string): Promise<boolean>`, `isArticleBookmarked(userId: string, articleId: string): Promise<boolean>`, `listArticleBookmarks(userId: string, page: number, limit: number): Promise<{ items: ArticleBookmarkItem[]; total: number }>`, and `ArticleBookmarkItem` (`{ id, articleId, createdAt, article: { id, title, coverImage, category, status } }`).

- [ ] **Step 1: Write the failing tests**

`tests/unit/article-bookmarks-db.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- article-bookmarks-db`
Expected: FAIL — `Cannot find module '@/features/bookmarks/db/article-bookmarks'`

- [ ] **Step 3: Write the implementation**

`features/bookmarks/db/article-bookmarks.ts`:

```typescript
import { db } from "@/drizzle/db"
import { and, desc, eq, sql } from "drizzle-orm"
import { userBookmarkArticle } from "@/drizzle/schema/user-bookmark-article-schema"
import { articles } from "@/drizzle/schema/articles-schema"

export type ArticleBookmarkItem = {
  id: string
  articleId: string
  createdAt: Date
  article: {
    id: string
    title: string
    coverImage: string | null
    category: string
    status: string
  }
}

export async function articleExistsById(articleId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1)
  return Boolean(row)
}

export async function addArticleBookmark(userId: string, articleId: string): Promise<void> {
  await db
    .insert(userBookmarkArticle)
    .values({ userId, articleId })
    .onConflictDoNothing({
      target: [userBookmarkArticle.userId, userBookmarkArticle.articleId],
    })
}

export async function removeArticleBookmark(userId: string, articleId: string): Promise<boolean> {
  const deleted = await db
    .delete(userBookmarkArticle)
    .where(and(eq(userBookmarkArticle.userId, userId), eq(userBookmarkArticle.articleId, articleId)))
    .returning({ id: userBookmarkArticle.id })
  return deleted.length > 0
}

export async function isArticleBookmarked(userId: string, articleId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: userBookmarkArticle.id })
    .from(userBookmarkArticle)
    .where(and(eq(userBookmarkArticle.userId, userId), eq(userBookmarkArticle.articleId, articleId)))
    .limit(1)
  return Boolean(row)
}

export async function listArticleBookmarks(
  userId: string,
  page: number,
  limit: number
): Promise<{ items: ArticleBookmarkItem[]; total: number }> {
  const offset = (page - 1) * limit

  const rows = await db
    .select({
      id: userBookmarkArticle.id,
      articleId: articles.id,
      createdAt: userBookmarkArticle.createdAt,
      title: articles.title,
      coverImage: articles.coverImage,
      category: articles.category,
      status: articles.status,
    })
    .from(userBookmarkArticle)
    .innerJoin(articles, eq(articles.id, userBookmarkArticle.articleId))
    .where(eq(userBookmarkArticle.userId, userId))
    .orderBy(desc(userBookmarkArticle.createdAt))
    .limit(limit)
    .offset(offset)

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userBookmarkArticle)
    .where(eq(userBookmarkArticle.userId, userId))

  return {
    items: rows.map((r) => ({
      id: r.id,
      articleId: r.articleId,
      createdAt: r.createdAt,
      article: {
        id: r.articleId,
        title: r.title,
        coverImage: r.coverImage,
        category: r.category,
        status: r.status,
      },
    })),
    total: countRows[0]?.count ?? 0,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- article-bookmarks-db`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add features/bookmarks/db/article-bookmarks.ts tests/unit/article-bookmarks-db.test.ts
git commit -m "feat: add article bookmark db query helpers"
```

---

### Task 5: Mobile route — `/api/mobile/bookmarks/news`

**Files:**
- Create: `app/api/mobile/bookmarks/news/route.ts`
- Test: `tests/api/mobile/bookmarks-news.test.ts`

**Interfaces:**
- Consumes: `newsBookmarkBodySchema`, `bookmarkListQuerySchema` (Task 2); `addNewsBookmark`, `removeNewsBookmark`, `listNewsBookmarks`, `newsExistsById` (Task 3); `auth.api.getSession` (`@/lib/auth`); `jsonError`, `jsonUncached`, `parseQuery` (`@/lib/api`).

- [ ] **Step 1: Write the failing tests**

`tests/api/mobile/bookmarks-news.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:api -- bookmarks-news`
Expected: FAIL — `Cannot find module '@/app/api/mobile/bookmarks/news/route'`

- [ ] **Step 3: Write the implementation**

`app/api/mobile/bookmarks/news/route.ts`:

```typescript
import { NextRequest, connection } from "next/server"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached, parseQuery } from "@/lib/api"
import { newsBookmarkBodySchema, bookmarkListQuerySchema } from "@/features/bookmarks/schemas/bookmark"
import {
  addNewsBookmark,
  removeNewsBookmark,
  listNewsBookmarks,
  newsExistsById,
} from "@/features/bookmarks/db/news-bookmarks"

/**
 * POST /api/mobile/bookmarks/news
 * Save one news article to the authenticated user's bookmarks.
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = newsBookmarkBodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const { newsId } = parsed.data
    if (!(await newsExistsById(newsId))) return jsonError("News not found", 404)

    await addNewsBookmark(session.user.id, newsId)
    return jsonUncached({ success: true, newsId })
  } catch (e) {
    console.error("POST /api/mobile/bookmarks/news:", e)
    return jsonError("Failed to save bookmark", 500)
  }
}

/**
 * GET /api/mobile/bookmarks/news
 * Paginated list of the authenticated user's bookmarked news.
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const { page, limit } = parseQuery(new URL(request.url).searchParams, bookmarkListQuerySchema)
    const { items, total } = await listNewsBookmarks(session.user.id, page, limit)

    return jsonUncached({ bookmarks: items, page, limit, total })
  } catch (e) {
    console.error("GET /api/mobile/bookmarks/news:", e)
    return jsonError("Failed to load bookmarks", 500)
  }
}

/**
 * DELETE /api/mobile/bookmarks/news
 * Remove one news article from the authenticated user's bookmarks.
 */
export async function DELETE(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = newsBookmarkBodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const { newsId } = parsed.data
    const removed = await removeNewsBookmark(session.user.id, newsId)
    return jsonUncached({ success: true, newsId, removed })
  } catch (e) {
    console.error("DELETE /api/mobile/bookmarks/news:", e)
    return jsonError("Failed to remove bookmark", 500)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:api -- bookmarks-news`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/mobile/bookmarks/news/route.ts tests/api/mobile/bookmarks-news.test.ts
git commit -m "feat: add mobile news bookmarks route (POST/GET/DELETE)"
```

---

### Task 6: Mobile route — `/api/mobile/bookmarks/article`

**Files:**
- Create: `app/api/mobile/bookmarks/article/route.ts`
- Test: `tests/api/mobile/bookmarks-article.test.ts`

**Interfaces:**
- Consumes: `articleBookmarkBodySchema`, `bookmarkListQuerySchema` (Task 2); `addArticleBookmark`, `removeArticleBookmark`, `listArticleBookmarks`, `articleExistsById` (Task 4); `auth.api.getSession`; `jsonError`, `jsonUncached`, `parseQuery`.

- [ ] **Step 1: Write the failing tests**

`tests/api/mobile/bookmarks-article.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:api -- bookmarks-article`
Expected: FAIL — `Cannot find module '@/app/api/mobile/bookmarks/article/route'`

- [ ] **Step 3: Write the implementation**

`app/api/mobile/bookmarks/article/route.ts`:

```typescript
import { NextRequest, connection } from "next/server"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached, parseQuery } from "@/lib/api"
import { articleBookmarkBodySchema, bookmarkListQuerySchema } from "@/features/bookmarks/schemas/bookmark"
import {
  addArticleBookmark,
  removeArticleBookmark,
  listArticleBookmarks,
  articleExistsById,
} from "@/features/bookmarks/db/article-bookmarks"

/**
 * POST /api/mobile/bookmarks/article
 * Save one article to the authenticated user's bookmarks.
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = articleBookmarkBodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const { articleId } = parsed.data
    if (!(await articleExistsById(articleId))) return jsonError("Article not found", 404)

    await addArticleBookmark(session.user.id, articleId)
    return jsonUncached({ success: true, articleId })
  } catch (e) {
    console.error("POST /api/mobile/bookmarks/article:", e)
    return jsonError("Failed to save bookmark", 500)
  }
}

/**
 * GET /api/mobile/bookmarks/article
 * Paginated list of the authenticated user's bookmarked articles.
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const { page, limit } = parseQuery(new URL(request.url).searchParams, bookmarkListQuerySchema)
    const { items, total } = await listArticleBookmarks(session.user.id, page, limit)

    return jsonUncached({ bookmarks: items, page, limit, total })
  } catch (e) {
    console.error("GET /api/mobile/bookmarks/article:", e)
    return jsonError("Failed to load bookmarks", 500)
  }
}

/**
 * DELETE /api/mobile/bookmarks/article
 * Remove one article from the authenticated user's bookmarks.
 */
export async function DELETE(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = articleBookmarkBodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const { articleId } = parsed.data
    const removed = await removeArticleBookmark(session.user.id, articleId)
    return jsonUncached({ success: true, articleId, removed })
  } catch (e) {
    console.error("DELETE /api/mobile/bookmarks/article:", e)
    return jsonError("Failed to remove bookmark", 500)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:api -- bookmarks-article`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/mobile/bookmarks/article/route.ts tests/api/mobile/bookmarks-article.test.ts
git commit -m "feat: add mobile article bookmarks route (POST/GET/DELETE)"
```

---

### Task 7: `isBookmarked` on the news detail response

**Files:**
- Modify: `app/api/news/[id]/route.ts`
- Modify: `tests/api/news.test.ts`

**Interfaces:**
- Consumes: `isNewsBookmarked` (Task 3), `auth.api.getSession`, `jsonCached`/`jsonUncached` (`@/lib/api`).

- [ ] **Step 1: Extend the existing test file with failing tests**

In `tests/api/news.test.ts`, add two imports at the top (after the existing imports):

```typescript
import { auth } from "@/lib/auth"
import { isNewsBookmarked } from "@/features/bookmarks/db/news-bookmarks"
```

Add two `vi.mock` calls (after the existing `vi.mock("@/features/news/db/news", ...)` block):

```typescript
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/bookmarks/db/news-bookmarks", () => ({
  isNewsBookmarked: vi.fn(),
}))
```

In the `describe("GET /api/news/[id]")` block's `beforeEach`, add a default so existing tests are unaffected:

```typescript
  beforeEach(() => {
    vi.mocked(getNewsById).mockResolvedValue(newsRow)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })
```

Add three new tests at the end of the `describe("GET /api/news/[id]")` block, before its closing `})`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm run test:api -- news.test`
Expected: the 3 new tests FAIL (`data.isBookmarked` is `undefined`); the pre-existing tests in this file still PASS.

- [ ] **Step 3: Modify the route**

In `app/api/news/[id]/route.ts`, replace the full file:

```typescript
import { NextRequest } from "next/server";
import { jsonCached, jsonError, jsonUncached } from "@/lib/api";
import { getNewsById } from "@/features/news/db/news";
import { estimateReadTimeMinutes } from "@/lib/read-time";
import { auth } from "@/lib/auth";
import { isNewsBookmarked } from "@/features/bookmarks/db/news-bookmarks";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const item = await getNewsById(id);
    if (!item) return jsonError("News not found", 404);
    if (item.status !== "published") return jsonError("News not found", 404);

    const payload = { ...item, readTime: estimateReadTimeMinutes(item.content) };

    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return jsonCached({ ...payload, isBookmarked: false });

    const isBookmarked = await isNewsBookmarked(session.user.id, id);
    return jsonUncached({ ...payload, isBookmarked });
  } catch (error) {
    console.error("GET /api/news/[id]:", error);
    return jsonError("Failed to fetch news", 500);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:api -- news.test`
Expected: PASS (all tests in the file, including the 3 new ones)

- [ ] **Step 5: Commit**

```bash
git add app/api/news/[id]/route.ts tests/api/news.test.ts
git commit -m "feat: add isBookmarked to news detail response, no-store for authenticated requests"
```

---

### Task 8: `isBookmarked` on the article detail response

**Files:**
- Modify: `app/api/articles/[id]/route.ts`
- Modify: `tests/api/articles.test.ts`

**Interfaces:**
- Consumes: `isArticleBookmarked` (Task 4), `auth.api.getSession`, `jsonCached`/`jsonUncached`.

- [ ] **Step 1: Extend the existing test file with failing tests**

In `tests/api/articles.test.ts`, add imports after the existing ones:

```typescript
import { auth } from "@/lib/auth"
import { isArticleBookmarked } from "@/features/bookmarks/db/article-bookmarks"
```

Add mocks after the existing `vi.mock("@/features/articles/db/articles", ...)` block:

```typescript
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/bookmarks/db/article-bookmarks", () => ({
  isArticleBookmarked: vi.fn(),
}))
```

Update the `describe("GET /api/articles/[id]")` block's `beforeEach`:

```typescript
  beforeEach(() => {
    vi.mocked(getArticleById).mockResolvedValue(articleRow)
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
  })
```

Add three new tests at the end of that `describe` block, before its closing `})`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm run test:api -- articles.test`
Expected: the 3 new tests FAIL; pre-existing tests in this file still PASS.

- [ ] **Step 3: Modify the route**

In `app/api/articles/[id]/route.ts`, replace the full file:

```typescript
import { NextRequest } from "next/server";
import { jsonCached, jsonError, jsonUncached } from "@/lib/api";
import { getArticleById } from "@/features/articles/db/articles";
import { estimateReadTimeMinutes } from "@/lib/read-time";
import { auth } from "@/lib/auth";
import { isArticleBookmarked } from "@/features/bookmarks/db/article-bookmarks";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const item = await getArticleById(id);
    if (!item) return jsonError("Article not found", 404);
    if (item.status !== "published") return jsonError("Article not found", 404);

    const payload = { ...item, readTime: estimateReadTimeMinutes(item.content) };

    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return jsonCached({ ...payload, isBookmarked: false });

    const isBookmarked = await isArticleBookmarked(session.user.id, id);
    return jsonUncached({ ...payload, isBookmarked });
  } catch (error) {
    console.error("GET /api/articles/[id]:", error);
    return jsonError("Failed to fetch article", 500);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:api -- articles.test`
Expected: PASS (all tests in the file, including the 3 new ones)

- [ ] **Step 5: Commit**

```bash
git add app/api/articles/[id]/route.ts tests/api/articles.test.ts
git commit -m "feat: add isBookmarked to article detail response, no-store for authenticated requests"
```

---

### Task 9: Documentation

**Files:**
- Create: `docs/technical/news-article-bookmarks.md`
- Create: `docs/guides/news-article-bookmarks.md`
- Create: `docs/api/mobile-bookmarks-news.md`
- Create: `docs/api/mobile-bookmarks-article.md`
- Modify: `docs/api/news.md`
- Modify: `docs/api/articles.md`

**Interfaces:** None — documentation only, no code.

- [ ] **Step 1: Write the technical doc**

`docs/technical/news-article-bookmarks.md`:

```markdown
# News & Article Bookmarks

## What changed

- `drizzle/schema/user-bookmark-news-schema.ts` (new) — `userBookmarkNews` table: `userId` (FK → `user.id`), `newsId` (FK → `news.id`), unique on `(userId, newsId)`.
- `drizzle/schema/user-bookmark-article-schema.ts` (new) — `userBookmarkArticle` table: same shape, FK → `articles.id`.
- `drizzle/schema.ts` — exports both new schema files.
- `features/bookmarks/schemas/bookmark.ts` (new) — Zod: `newsBookmarkBodySchema`, `articleBookmarkBodySchema`, `bookmarkListQuerySchema`.
- `features/bookmarks/db/news-bookmarks.ts`, `features/bookmarks/db/article-bookmarks.ts` (new) — query helpers: add/remove/list/exists/isBookmarked, one module per content type.
- `app/api/mobile/bookmarks/news/route.ts`, `app/api/mobile/bookmarks/article/route.ts` (new) — mobile POST/GET/DELETE endpoints.
- `app/api/news/[id]/route.ts`, `app/api/articles/[id]/route.ts` — detail responses now include `isBookmarked`.

## Data flow

**Save/unsave:** mobile app calls `POST`/`DELETE /api/mobile/bookmarks/news` (or `/article`) with `{ newsId }`/`{ articleId }` and a bearer token → route validates the session and body → checks the target row exists (`POST` only) → inserts/deletes the bookmark row.

**List ("Saved" screen):** `GET /api/mobile/bookmarks/news` (or `/article`) → joins the bookmark table to `news`/`articles` for display fields (`title`, `coverImage`, `category`, `status`), ordered newest-first, paginated.

**Detail screen icon:** `GET /api/news/[id]` (or `/api/articles/[id]`) now checks the session. No session → `isBookmarked: false`, response stays on the public CDN cache (`jsonCached`). Session present → looks up `isNewsBookmarked`/`isArticleBookmarked` for that user, response switches to `jsonUncached` (`no-store`) since it is now personalized.

## Schema impact

Two new tables, no changes to existing tables. `user_bookmark_news` and `user_bookmark_article` both cascade-delete when the referenced `user`, `news`, or `article` row is deleted. **Migration not yet applied** — schema files were written but `db:generate`/`db:migrate` must be run manually per this repo's convention before the routes work against a real database.

## Auth & permissions

All five new endpoints (`POST`/`GET`/`DELETE` × 2, using session identity for scoping) require a valid Better Auth session (`auth.api.getSession`); `401` if absent. The detail routes (`/api/news/[id]`, `/api/articles/[id]`) remain public — the session check there is optional and only changes whether `isBookmarked` is computed.

## Edge cases & known limitations

- A previously-bookmarked item that is later unpublished still appears in the `GET` bookmarks list (with its current `status`), not silently dropped — the app decides how to render it.
- `POST` on an already-bookmarked item is idempotent (`onConflictDoNothing`), not an error.
- `DELETE` on a non-bookmarked item returns `removed: false`, not an error.
- Authenticated detail-page requests lose the CDN cache (`no-store`) since the response is now per-user; anonymous requests are unaffected.
- Product bookmarks (`userFavouriteProduct` / `/api/mobile/favourite-products`) are a separate, pre-existing system — not touched or unified by this change.
```

- [ ] **Step 2: Write the collaborator guide**

`docs/guides/news-article-bookmarks.md`:

```markdown
# News & Article Bookmarks — Collaborator Guide

## Prerequisites

- A running dev server with `DATABASE_URL` set (see root `CLAUDE.md`).
- The `user_bookmark_news`/`user_bookmark_article` migration applied (`npm run db:generate` then `npm run db:migrate` — ask whoever owns migrations in this repo to run these; they are not run automatically).
- A logged-in mobile session (bearer token) to exercise the authenticated endpoints.

## Using the feature

**Save a news article:**

```bash
curl -X POST http://localhost:3000/api/mobile/bookmarks/news \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"newsId": "<news-uuid>"}'
```

**List saved news (paginated):**

```bash
curl "http://localhost:3000/api/mobile/bookmarks/news?page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```

**Unsave:**

```bash
curl -X DELETE http://localhost:3000/api/mobile/bookmarks/news \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"newsId": "<news-uuid>"}'
```

Articles use the identical shape at `/api/mobile/bookmarks/article` with `articleId` instead of `newsId`.

**Detail screen icon state:** `GET /api/news/[id]` (no auth required) includes `isBookmarked` in its response — pass the same bearer token as a cookie/header if you want the personalized value; omit it for the anonymous, cacheable response.

## Extending it

**Add a third bookmarkable content type (e.g. products, if migrating off `userFavouriteProduct` later):**
1. Add a `user_bookmark_<type>-schema.ts` table (copy `user-bookmark-news-schema.ts`, swap the FK).
2. Add a `features/bookmarks/db/<type>-bookmarks.ts` module (copy `news-bookmarks.ts`, swap the table/field names).
3. Add `<type>BookmarkBodySchema` to `features/bookmarks/schemas/bookmark.ts`.
4. Add `app/api/mobile/bookmarks/<type>/route.ts` (copy `news/route.ts`).
5. Add the `isBookmarked` check to that content type's detail route, same pattern as `app/api/news/[id]/route.ts`.

**Common errors:**
- `401 Unauthorized` on the bookmark endpoints → missing/invalid bearer token; the detail routes never 401, they just omit the personalization.
- `404 "News not found"` / `"Article not found"` on `POST` → the `newsId`/`articleId` doesn't exist (or was deleted) — not a bookmark-specific error.
- `isBookmarked` always `false` even when logged in → check the request actually carries the session (cookie/header); a missing session silently falls back to the anonymous path rather than erroring.
```

- [ ] **Step 3: Write the API doc for mobile news bookmarks**

`docs/api/mobile-bookmarks-news.md`:

```markdown
# Mobile News Bookmarks API

Consumed by the **mobile app** ("Saved" screen and the bookmark icon on the news detail screen). All three endpoints require a Better Auth session (bearer token).

## POST /api/mobile/bookmarks/news

**Auth:** bearer token (required)
**Body:** `{ "newsId": "<uuid>" }` (validated by `newsBookmarkBodySchema` in `features/bookmarks/schemas/bookmark.ts`)

**Response 200:**

```json
{ "success": true, "newsId": "3f8a2b1c-4d5e-4f60-8a7b-9c0d1e2f3a4b" }
```

**Errors:**
- `401 {"error": "Unauthorized"}`
- `400 {"error": "Invalid input"}` — `newsId` missing or not a UUID
- `404 {"error": "News not found"}`
- `500 {"error": "Failed to save bookmark"}`

Idempotent — bookmarking an already-bookmarked item still returns `200`.

**Example:**

```bash
curl -X POST http://localhost:3000/api/mobile/bookmarks/news \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"newsId": "3f8a2b1c-4d5e-4f60-8a7b-9c0d1e2f3a4b"}'
```

## GET /api/mobile/bookmarks/news

**Auth:** bearer token (required)
**Query params:** `page` (int ≥ 1, default 1), `limit` (int 1–50, default 10)

**Response 200:**

```json
{
  "bookmarks": [
    {
      "id": "bm-1",
      "newsId": "3f8a2b1c-...",
      "createdAt": "2026-07-01T00:00:00.000Z",
      "news": {
        "id": "3f8a2b1c-...",
        "title": "Market update",
        "coverImage": "https://.../cover.jpg",
        "category": "market",
        "status": "published"
      }
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 1
}
```

Ordered newest-bookmarked-first. A bookmarked item whose `status` is no longer `published` still appears (with its current status) rather than being silently dropped.

**Errors:** `401`, `500 {"error": "Failed to load bookmarks"}`

## DELETE /api/mobile/bookmarks/news

**Auth:** bearer token (required)
**Body:** `{ "newsId": "<uuid>" }`

**Response 200:**

```json
{ "success": true, "newsId": "3f8a2b1c-...", "removed": true }
```

`removed: false` (still `200`) if the item wasn't bookmarked.

**Errors:** `401`, `400`, `500 {"error": "Failed to remove bookmark"}`

**Mobile flag:** yes — this entire route is mobile-only (`/api/mobile/*`).
```

- [ ] **Step 4: Write the API doc for mobile article bookmarks**

`docs/api/mobile-bookmarks-article.md`:

```markdown
# Mobile Article Bookmarks API

Identical shape to [Mobile News Bookmarks API](./mobile-bookmarks-news.md), with `articleId` instead of `newsId` and `article` instead of `news` in list responses.

## POST /api/mobile/bookmarks/article

**Auth:** bearer token (required)
**Body:** `{ "articleId": "<uuid>" }` (validated by `articleBookmarkBodySchema`)

**Response 200:** `{ "success": true, "articleId": "<uuid>" }`
**Errors:** `401`, `400 {"error": "Invalid input"}`, `404 {"error": "Article not found"}`, `500 {"error": "Failed to save bookmark"}`

## GET /api/mobile/bookmarks/article

**Auth:** bearer token (required)
**Query params:** `page` (default 1), `limit` (1–50, default 10)

**Response 200:**

```json
{
  "bookmarks": [
    {
      "id": "bm-2",
      "articleId": "7c1d2e3f-...",
      "createdAt": "2026-07-01T00:00:00.000Z",
      "article": {
        "id": "7c1d2e3f-...",
        "title": "Gemstone Identification",
        "coverImage": null,
        "category": "gemology",
        "status": "published"
      }
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 1
}
```

**Errors:** `401`, `500 {"error": "Failed to load bookmarks"}`

## DELETE /api/mobile/bookmarks/article

**Auth:** bearer token (required)
**Body:** `{ "articleId": "<uuid>" }`

**Response 200:** `{ "success": true, "articleId": "<uuid>", "removed": true|false }`
**Errors:** `401`, `400`, `500 {"error": "Failed to remove bookmark"}`

**Mobile flag:** yes — mobile-only route.
```

- [ ] **Step 5: Update the existing news and articles API docs**

In `docs/api/news.md`, in the `GET /api/news/[id]` section, replace:

```markdown
**Response 200:** a single news object (same shape as list items, including `readTime`).
```

with:

```markdown
**Response 200:** a single news object (same shape as list items, including `readTime`), plus `isBookmarked` (boolean).

**Auth (optional):** if a valid session is present, `isBookmarked` reflects that user's bookmark state and the response is `Cache-Control: no-store` (personalized). Without a session, `isBookmarked` is always `false` and the response keeps the shared `public, s-maxage=60` cache.
```

In `docs/api/articles.md`, in the `GET /api/articles/[id]` section, replace:

```markdown
**Response 200:** a single article object (same shape as list items, including `readTime`).
```

with:

```markdown
**Response 200:** a single article object (same shape as list items, including `readTime`), plus `isBookmarked` (boolean).

**Auth (optional):** if a valid session is present, `isBookmarked` reflects that user's bookmark state and the response is `Cache-Control: no-store` (personalized). Without a session, `isBookmarked` is always `false` and the response keeps the shared `public, s-maxage=60` cache.
```

- [ ] **Step 6: Commit**

```bash
git add docs/technical/news-article-bookmarks.md docs/guides/news-article-bookmarks.md \
  docs/api/mobile-bookmarks-news.md docs/api/mobile-bookmarks-article.md \
  docs/api/news.md docs/api/articles.md
git commit -m "docs: document news/article bookmarks feature"
```

---

## After all tasks

Run the full suite once more to confirm nothing regressed:

```bash
npm run test
```

Then tell the user: the schema files are written but **no migration has been generated or applied** — they need to run `npm run db:generate` and `npm run db:migrate` themselves before the new endpoints work against a real database (per this repo's convention, migrations are never run automatically).
