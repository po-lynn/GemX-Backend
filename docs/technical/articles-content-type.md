# Articles content Type (News | Articles)

## What changed

Unified the admin Content nav label and added an editorial **Type** field on create/update.

**Files touched**
- `components/admin/AdminSidebar.tsx` — Content link label → **News & Articles**
- `features/content/schemas/content.ts` — `CONTENT_TYPES`, `CONTENT_TYPE_LABELS`, `contentTypeSchema`
- `drizzle/schema/articles-schema.ts` — `type` column (`news` | `article`, default `article`)
- `drizzle/migrations/0083_articles_content_type.sql` — migration
- `features/articles/schemas/articles.ts` — create/update/list Zod include `type`
- `features/articles/db/articles.ts` — persist + optional list filter by `type`
- `features/articles/actions/articles.ts` — create/update read `type` from FormData
- `features/articles/components/ArticleForm.tsx` — Type dropdown on create & edit
- `features/articles/components/ArticlesTable.tsx` — show type in title meta
- `app/admin/articles/page.tsx` — page title **News & Articles**
- `app/api/articles/route.ts` — optional `type` query filter

## Data flow

```
ArticleForm (select name=type)
  → createArticleAction / updateArticleAction (Zod)
  → createArticleInDb / updateArticleInDb
  → articles.type
  → GET /api/articles?type=news|article (optional filter)
```

Stored values: `news`, `article`. UI labels: **News**, **Articles**.

## Schema impact

| Column | Before | After |
|--------|--------|-------|
| `articles.type` | — | `text NOT NULL DEFAULT 'article'` |

Migration: `0083_articles_content_type.sql`. Existing rows become `article`.

## Auth & permissions

Unchanged. Still gated by `FEATURE_KEYS.ARTICLES` for admin pages/actions. Public list/detail remain public; `type` is included when selecting the full row.

## Edge cases & known limitations

- The legacy `/admin/news` stack and `news` table are unchanged; Type lives on `articles` only.
- Default Type on create is **Articles** (`article`).
- Mobile apps can filter with `?type=news` or `?type=article`; without `type`, both kinds are returned.
