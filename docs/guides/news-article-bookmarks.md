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
