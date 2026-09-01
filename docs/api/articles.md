# Articles API

Consumed by the **mobile app** (Articles tab of the "News & Articles" screen). Public — no auth.

## Localized fields

| Field | Type |
|-------|------|
| `language` | `English` \| `Myanmar` \| `Thai` \| `Korean` |
| `titleEn` `titleMy` `titleTh` `titleKo` | string \| null |
| `contentEn` `contentMy` `contentTh` `contentKo` | string \| null |

## GET /api/articles

**Auth:** public  
**Query params** (validated by `articleListQuerySchema` in `features/articles/schemas/articles.ts`; invalid values fall back to defaults):

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` | int ≥ 1 | 1 | |
| `limit` | int 1–100 | 20 | |
| `status` | `draft` \| `published` | `published` | |
| `search` | string ≤ 200 | — | case-insensitive title match |
| `category` | `general` \| `market` \| `gemology` \| `guides` \| `product` | — | filter chip |
| `featured` | `true` \| `false` | — | `featured=true` fetches the hero card |
| `lang` | `English` \| `Myanmar` \| `Thai` \| `Korean` | — | Remaps `title`/`content` from localized columns |

**Response 200:**

```json
{
  "articles": [
    {
      "id": "7c1d2e3f-...",
      "title": "Gemstone Identification: How to Verify Gemstones",
      "slug": "gemstone-identification-how-to-verify-gemstones",
      "language": "English",
      "titleEn": "…",
      "titleMy": null,
      "titleTh": null,
      "titleKo": null,
      "content": "[{...BlockNote JSON...}]",
      "contentEn": "…",
      "contentMy": null,
      "contentTh": null,
      "contentKo": null,
      "author": "Gem X Newsroom",
      "category": "gemology",
      "coverImage": null,
      "isFeatured": false,
      "status": "published",
      "publishDate": "2026-05-20T00:00:00.000Z",
      "createdAt": "2026-05-18T00:00:00.000Z",
      "updatedAt": "2026-05-20T00:00:00.000Z",
      "readTime": 4
    }
  ],
  "total": 2,
  "categoryCounts": { "all": 2, "gemology": 1, "guides": 1 }
}
```

- `readTime` — estimated minutes (200 wpm, min 1), computed from the (possibly localized) content.
- `categoryCounts` — published-article counts per category for the filter chips; unaffected by `search`/`featured`.
- Sorted by publish date (falling back to creation date), newest first.

**Errors:** `500 {"error": "Failed to fetch articles"}`

**Example:**

```bash
curl "http://localhost:3000/api/articles?search=gemstone&category=gemology"
curl "http://localhost:3000/api/articles?lang=Thai"
```

## GET /api/articles/[id]

**Auth:** public. Only `published` items are returned.

**Query:** optional `lang` (same values as list) — remaps `title` and `content`.

**Response 200:** a single article object (same shape as list items, including `readTime` and localized columns), plus `isBookmarked` (boolean).

**Auth (optional):** if a valid session is present, `isBookmarked` reflects that user's bookmark state and the response is `Cache-Control: no-store` (personalized). Without a session, `isBookmarked` is always `false` and the response keeps the shared `public, s-maxage=60` cache.

**Errors:**
- `404 {"error": "Article not found"}` — missing or unpublished
- `500 {"error": "Failed to fetch article"}`

**Example:**

```bash
curl "http://localhost:3000/api/articles/7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f"
curl "http://localhost:3000/api/articles/7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f?lang=Korean"
```

**Caching:** both endpoints return `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` (when unauthenticated).

**Mobile:** yes (`/api/articles/*`).

## Admin create

`createArticleAction` requires `GOOGLE_TRANSLATE_API_KEY`. On failure: `{ "error": "…" }` and no insert.
