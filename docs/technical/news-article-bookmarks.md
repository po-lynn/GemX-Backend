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

All six new endpoints (`POST`/`GET`/`DELETE` × 2, using session identity for scoping) require a valid Better Auth session (`auth.api.getSession`); `401` if absent. The detail routes (`/api/news/[id]`, `/api/articles/[id]`) remain public — the session check there is optional and only changes whether `isBookmarked` is computed.

## Edge cases & known limitations

- A previously-bookmarked item that is later unpublished still appears in the `GET` bookmarks list (with its current `status`), not silently dropped — the app decides how to render it.
- `POST` on an already-bookmarked item is idempotent (`onConflictDoNothing`), not an error.
- `DELETE` on a non-bookmarked item returns `removed: false`, not an error.
- Authenticated detail-page requests lose the CDN cache (`no-store`) since the response is now per-user; anonymous requests are unaffected.
- Product bookmarks (`userFavouriteProduct` / `/api/mobile/favourite-products`) are a separate, pre-existing system — not touched or unified by this change.
