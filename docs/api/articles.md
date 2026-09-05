# GET /api/articles

**Endpoint:** `GET /api/articles`  
**Auth:** public  
**Mobile:** yes (articles feed)

## Request

### Query params

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` | int ≥ 1 | `1` | |
| `limit` | int 1–100 | `20` | Invalid/over max falls back to 20 |
| `status` | `draft` \| `published` | `published` | |
| `search` | string | — | Title `ilike` |
| `type` | `news` \| `article` | — | Editorial Type filter |
| `category` | content category | — | |
| `featured` | `true` \| `false` | — | |
| `lang` | English \| Myanmar \| Thai \| Korean | — | Localized title/content |

Zod: `articleListQuerySchema` in `features/articles/schemas/articles.ts`.

## Response

Success envelope includes `articles`, `total`, `categoryCounts`. Each article includes `type` (`news` | `article`) plus existing fields (`title`, `content`, `readTime`, etc.).

### Errors

| Status | Message |
|--------|---------|
| 500 | Failed to fetch articles |

## Example

```bash
curl -s "http://localhost:3000/api/articles?type=news&limit=5"
```

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
