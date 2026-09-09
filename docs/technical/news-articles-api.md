# API: `/api/news-articles` (News & Articles)

## What changed

Added public list/detail routes that read the **`articles`** table (admin **News & Articles** menu), including optional **`type`** (`news` \| `article`).

| Path | Role |
|------|------|
| `app/api/news-articles/route.ts` | `GET` list |
| `app/api/news-articles/[id]/route.ts` | `GET` detail |
| `tests/api/news-articles.test.ts` | API tests |
| `docs/api/news-articles.md` | Route reference |
| `docs/MOBILE-API.md` | Mobile contract |

Reuses `getArticlesPaginatedFromDb`, `getArticleById`, `getArticleCategoryCountsFromDb`, and `articleListQuerySchema` — no new schema.

## Data flow

```
GET /api/news-articles?type=news&lang=Thai
  → articleListQuerySchema
  → getArticlesPaginatedFromDb({ type, … })  // articles table
  → pickLocalized* + readTime
  → { articles, total, categoryCounts }
```

## Schema impact

None.

## Auth

Public. Detail: session optional for `isBookmarked`.

## Edge cases

- Same published-only detail rules as `/api/articles/:id`.
- Invalid `type` is ignored (Zod `.catch(undefined)`).
- `/api/articles` unchanged (same backing table).
