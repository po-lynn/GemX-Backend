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
