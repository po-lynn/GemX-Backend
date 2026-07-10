# News & Article Bookmarks — Design Spec

**Date:** 2026-07-10
**Scope:** Backend/mobile-API support for the bookmark icon on the mobile news/article detail screen — save/unsave, list saved items, and a per-item "is this bookmarked" flag on the detail response.

---

## Problem

The mobile news detail screen has a bookmark icon (top-right, next to share) but there is no backend support for it: no table to persist "user saved this news/article," no mobile endpoint to save/unsave/list, and the detail responses (`GET /api/news/[id]`, `GET /api/articles/[id]`) don't report whether the current user has already bookmarked the item — so the app has no way to render a filled vs. outline icon.

---

## Approach

**Two parallel tables (`user_bookmark_news`, `user_bookmark_article`), mirroring the existing `userFavouriteProduct` pattern exactly** — same shape, same mobile-route conventions, same query style. `userFavouriteProduct` (`drizzle/schema/user-favourite-product-schema.ts`) already implements this exact concept for products ("User-saved products (bookmarks/favourites) for mobile 'Saved' screen") and its mobile route (`app/api/mobile/favourite-products/route.ts`) is the direct template for POST/GET/DELETE here.

Rejected alternatives:
- **Single polymorphic table** (`bookmark` with `contentType` + `contentId`, no FK on `contentId`): loses DB-level referential integrity — a bad `contentId` would silently orphan instead of being rejected at insert time. No precedent for this shape in the codebase.
- **Single table with two nullable FK columns** (`newsId` / `articleId`, check constraint exactly one set): keeps FK integrity but requires an awkward conditional unique index and always-half-null rows. Also no precedent.
- **A shared generic "bookmark engine" parameterized over the target table**: over-abstracted for two tables — `userFavouriteProduct` itself has no such generic engine for its own domain. Two structurally-identical, independently-readable modules is the established style here (see also `sellerRating` for a different user-to-user pattern).

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `drizzle/schema/user-bookmark-news-schema.ts` | `userBookmarkNews` table + relations |
| `drizzle/schema/user-bookmark-article-schema.ts` | `userBookmarkArticle` table + relations |
| `features/bookmarks/schemas/bookmark.ts` | Zod: `newsBookmarkBodySchema` (`{ newsId }`), `articleBookmarkBodySchema` (`{ articleId }`), shared `listQuerySchema` (`page`/`limit`) |
| `app/api/mobile/bookmarks/news/route.ts` | `POST` / `GET` / `DELETE` for news bookmarks |
| `app/api/mobile/bookmarks/article/route.ts` | `POST` / `GET` / `DELETE` for article bookmarks |

### Modified files

| File | Change |
|------|--------|
| `drizzle/schema.ts` | Export the two new schema files |
| `app/api/news/[id]/route.ts` | Check session; include `isBookmarked`; switch to `jsonUncached` only when a session is present |
| `app/api/articles/[id]/route.ts` | Same as above |

---

## Schema

```typescript
// drizzle/schema/user-bookmark-news-schema.ts
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
```

`user-bookmark-article-schema.ts` is the same shape with `articleId` → `references(() => articles.id)` (table is exported as `articles`, per `drizzle/schema/articles-schema.ts`).

Both get a `relations()` block mirroring `userFavouriteProductRelations` (one-to-one `user`, one-to-one `news`/`article`).

---

## Mobile API routes

Both routes copy the structure of `app/api/mobile/favourite-products/route.ts` verbatim, substituting `productId` → `newsId`/`articleId` and the joined table:

- **`POST`** — requires session (401 if absent). Validates body, confirms the target row exists (404 `"News not found"` / `"Article not found"` if not — same guard as the existing favourite-products existence check), inserts with `.onConflictDoNothing({ target: [userId, newsId/articleId] })`. Returns `jsonUncached({ success: true, newsId })`.
- **`DELETE`** — requires session. Deletes the row matching `(userId, newsId/articleId)`, returns `jsonUncached({ success: true, newsId, removed: boolean })`.
- **`GET`** — requires session. Paginated (`page`/`limit`, same `listQuerySchema` shape as favourite-products: `limit` capped at 50, default 10). Joins the bookmark table to `news`/`articles` for `title`, `coverImage`, `category`, `status`, `publish`/`publishDate`, `createdAt` (bookmark row's, for sort order). Ordered `desc(createdAt)`. Returns:
  ```json
  { "bookmarks": [{ "id", "newsId", "createdAt", "news": { "id", "title", "coverImage", "category", "status" } }], "page", "limit", "total" }
  ```
  Filters out items whose `status !== "published"` at read time is **not** done — a previously-bookmarked item that later got unpublished still shows in "My Bookmarks" (with its current `status` field so the app can grey it out), consistent with how a user's own saved list shouldn't silently lose items. The app decides how to render a non-published bookmark.

Both routes: `await connection()` first, try/catch with `console.error` + `jsonError(..., 500)` on unexpected failure, matching every existing mobile route.

---

## `isBookmarked` on the detail response — caching fix

`GET /api/news/[id]` and `GET /api/articles/[id]` currently always call `jsonCached(...)`, which sets `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` (`lib/api.ts:8`) — a **shared CDN cache**. Baking a per-user `isBookmarked` into that response unmodified would let one user's bookmark state get served to a different user for up to 60 seconds: a cross-user data leak, not just staleness.

Fix — branch on session presence:

```typescript
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const item = await getNewsById(id)
    if (!item) return jsonError("News not found", 404)
    if (item.status !== "published") return jsonError("News not found", 404)

    const session = await auth.api.getSession({ headers: request.headers })
    const payload = { ...item, readTime: estimateReadTimeMinutes(item.content) }

    if (!session) {
      return jsonCached({ ...payload, isBookmarked: false })
    }

    const isBookmarked = await isNewsBookmarked(session.user.id, id)
    return jsonUncached({ ...payload, isBookmarked })
  } catch (error) {
    console.error("GET /api/news/[id]:", error)
    return jsonError("Failed to fetch news", 500)
  }
}
```

(Same change in `app/api/articles/[id]/route.ts`, using an `isArticleBookmarked` helper.) Anonymous/logged-out traffic (the vast majority of detail-page views) keeps the existing CDN cache untouched; only authenticated requests lose caching, which is correct since their response is now personalized.

`isNewsBookmarked(userId, newsId)` / `isArticleBookmarked(userId, articleId)` live alongside the other bookmark queries and do a single `exists`-style lookup (`select id ... where userId = ... and newsId = ... limit 1`).

---

## Error handling

- No session on `POST`/`GET`/`DELETE` bookmark routes → `401 Unauthorized` (matches every other mobile route).
- `POST` with a `newsId`/`articleId` that doesn't exist → `404` (`"News not found"` / `"Article not found"`), same as the favourite-products existence guard.
- `POST` on an already-bookmarked item → `onConflictDoNothing`, still returns `{ success: true }` (idempotent, no error).
- `DELETE` on a non-bookmarked item → `{ success: true, removed: false }`, not an error (matches favourite-products `removed: Boolean(deleted)`).
- Detail-route session lookup failing unexpectedly is caught by the existing outer try/catch → `500`.

---

## Tests

**`tests/unit/bookmark-schemas.test.ts`**
- `newsBookmarkBodySchema` / `articleBookmarkBodySchema` reject non-UUID / missing id
- `listQuerySchema` defaults (`page=1`, `limit=10`) and caps `limit` at 50

**`tests/api/mobile-bookmarks-news.test.ts`** (and article equivalent)
- `POST` without session → 401
- `POST` with valid `newsId` → inserts, returns `success: true`
- `POST` with non-existent `newsId` → 404
- `POST` twice (duplicate) → no error, still `success: true`, only one row (mock `onConflictDoNothing` path)
- `GET` without session → 401
- `GET` returns paginated bookmarks joined with news fields, correct `total`
- `DELETE` without session → 401
- `DELETE` existing bookmark → `removed: true`; `DELETE` non-existent → `removed: false`

**`tests/api/news-detail-bookmark-flag.test.ts`** (and article equivalent)
- No session → `isBookmarked: false`, response uses public cache headers
- Session, item bookmarked → `isBookmarked: true`, response uses `no-store`
- Session, item not bookmarked → `isBookmarked: false`, response uses `no-store`

---

## Out of scope

- A "My Bookmarks" admin-side view (this is mobile-app-only, per the mockup)
- Bookmarking products via this new module (already covered by `userFavouriteProduct` — not migrated or unified)
- Bookmark counts/analytics (e.g. "127 people saved this")
- Push notifications when a bookmarked item is updated/unpublished
- Any change to the anonymous-cache TTL/strategy itself (`s-maxage=60` stays as-is for anonymous traffic)
