# News API

Consumed by the **mobile app** (News tab of the "News & Articles" screen). Public — no auth.

## GET /api/news

**Auth:** public
**Query params** (validated by `newsListQuerySchema` in `features/news/schemas/news.ts`; invalid values fall back to defaults):

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` | int ≥ 1 | 1 | |
| `limit` | int 1–100 | 20 | |
| `status` | `draft` \| `published` | `published` | |
| `search` | string ≤ 200 | — | case-insensitive title match |
| `category` | `general` \| `market` \| `gemology` \| `guides` \| `product` | — | filter chip |
| `featured` | `true` \| `false` | — | `featured=true` fetches the hero card |

**Response 200:**

```json
{
  "news": [
    {
      "id": "3f8a2b1c-...",
      "title": "မြန်မာနိုင်ငံသည် သဘာဝသယံဇာတ...",
      "content": "[{...BlockNote JSON...}]",
      "author": "Gem X Newsroom",
      "category": "market",
      "coverImage": "https://.../cover.jpg",
      "isFeatured": true,
      "status": "published",
      "publish": "2026-06-05T00:00:00.000Z",
      "createdAt": "2026-06-01T00:00:00.000Z",
      "updatedAt": "2026-06-05T00:00:00.000Z",
      "readTime": 6
    }
  ],
  "total": 9,
  "categoryCounts": { "all": 9, "market": 4, "gemology": 3, "guides": 2 }
}
```

- `readTime` — estimated minutes (200 wpm, min 1), computed server-side.
- `categoryCounts` — published-news counts per category for the filter chips; unaffected by `search`/`featured`.
- Sorted by publish date (falling back to creation date), newest first.

**Errors:** `500 {"error": "Failed to fetch news"}`

**Example:**

```bash
curl "http://localhost:3000/api/news?category=market&featured=true&limit=1"
```

## GET /api/news/[id]

**Auth:** public. Only `published` items are returned.

**Response 200:** a single news object (same shape as list items, including `readTime`).

**Errors:**
- `404 {"error": "News not found"}` — missing or unpublished
- `500 {"error": "Failed to fetch news"}`

**Example:**

```bash
curl "http://localhost:3000/api/news/3f8a2b1c-4d5e-4f60-8a7b-9c0d1e2f3a4b"
```

**Caching:** both endpoints return `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.
