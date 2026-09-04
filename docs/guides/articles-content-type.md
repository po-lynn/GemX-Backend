# News & Articles admin Type field

## Prerequisites

1. Apply DB migration: `npm run db:migrate` (adds `articles.type`).
2. Admin user with Articles permission (`FEATURE_KEYS.ARTICLES`).

## How to use

1. Open **Content → News & Articles** in the admin sidebar.
2. Click **New** (or edit an existing row).
3. Set **Type** to **News** or **Articles**.
4. Save draft or publish as usual.

List rows show the type next to the category in the title meta line.

### API filter (optional)

```bash
curl "$NEXT_PUBLIC_SERVER_URL/api/articles?type=news&status=published"
curl "$NEXT_PUBLIC_SERVER_URL/api/articles?type=article&status=published"
```

## How to extend

- Add a new kind: extend `CONTENT_TYPES` / `CONTENT_TYPE_LABELS` in `features/content/schemas/content.ts`, then update UI options (they map over `CONTENT_TYPES`).
- Add admin list tabs by type: pass `type` into `getArticlesPaginatedFromDb` from `app/admin/articles/page.tsx`.

## Common errors

- **Column `type` does not exist:** run `npm run db:migrate`.
- **Validation error on type:** only `news` and `article` are allowed (case-sensitive).
