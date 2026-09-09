# Guide: News & Articles mobile API (`/api/news-articles`)

## Prerequisites

Rows in the **`articles`** table (created via Admin → **News & Articles**). Optional `type` on each row: `news` or `article`.

## How to use

```bash
# All published (both types)
curl -s "$BASE/api/news-articles"

# News only
curl -s "$BASE/api/news-articles?type=news"

# Articles only, Thai UI
curl -s "$BASE/api/news-articles?type=article&lang=Thai&page=1&limit=20"

# Detail
curl -s "$BASE/api/news-articles/<uuid>"
```

Response list key is still **`articles`** (same shape as `/api/articles`) plus `total` and `categoryCounts`.

## How to extend

Filters live in `articleListQuerySchema` / `getArticlesPaginatedFromDb`. Prefer changing those shared helpers so `/api/articles` and `/api/news-articles` stay in sync.

## Common errors

| Error | Fix |
|-------|-----|
| Empty list | Publish items in admin; check `?status=` / `?type=` |
| 404 on detail | Draft or wrong id |
| Missing `type` on old rows | Default is `article` (migration 0083) |
