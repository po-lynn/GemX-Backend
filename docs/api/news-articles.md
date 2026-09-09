# GET /api/news-articles

**Endpoint:** `GET /api/news-articles` · `GET /api/news-articles/:id`  
**Auth:** public (detail adds `isBookmarked` when session present)  
**Mobile:** yes — unified **News & Articles** feed from the `articles` table  
**Source:** same data/helpers as `/api/articles` (`features/articles/db/articles.ts`)

## List — GET /api/news-articles

### Query params

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` | int ≥ 1 | `1` | |
| `limit` | int 1–100 | `20` | |
| `status` | `draft` \| `published` | `published` | |
| `search` | string | — | Title `ilike` |
| `type` | `news` \| `article` | — | Admin **Type** filter (`articles.type`) |
| `category` | content category | — | |
| `featured` | `true` \| `false` | — | |
| `lang` | English \| Myanmar \| Thai \| Korean | — | Localized title/content |

Zod: `articleListQuerySchema` in `features/articles/schemas/articles.ts`.

### Response 200

```json
{
  "articles": [
    {
      "id": "…",
      "title": "Market flash",
      "type": "news",
      "category": "market",
      "status": "published",
      "readTime": 2
    }
  ],
  "total": 1,
  "categoryCounts": { "all": 1, "market": 1 }
}
```

### Errors

| Status | Message |
|--------|---------|
| 500 | Failed to fetch news articles |

### Example

```bash
curl -s "http://localhost:3000/api/news-articles?type=news&limit=5"
curl -s "http://localhost:3000/api/news-articles?type=article&lang=Thai"
```

## Detail — GET /api/news-articles/:id

Published only. Optional `?lang=`. Same shape as list item + `isBookmarked`.

| Status | Message |
|--------|---------|
| 404 | Article not found |
| 500 | Failed to fetch news article |

```bash
curl -s "http://localhost:3000/api/news-articles/<uuid>?lang=Myanmar"
```

## Mobile flag

Yes — prefer this path for the combined News & Articles UI. `/api/articles` remains available as an alias of the same table.
