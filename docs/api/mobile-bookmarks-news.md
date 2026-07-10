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
