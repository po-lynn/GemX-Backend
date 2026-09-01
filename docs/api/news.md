# API: News localized titles & content

Mobile: **yes**.

## New/updated fields on news items

| Field | Type |
|-------|------|
| `language` | `English` \| `Myanmar` \| `Thai` \| `Korean` |
| `titleEn` `titleMy` `titleTh` `titleKo` | string \| null |
| `contentEn` `contentMy` `contentTh` `contentKo` | string \| null |

## Query: `lang`

On **GET `/api/news`** and **GET `/api/news/:id`**:

| Value | Effect |
|-------|--------|
| omitted | `title` / `content` are the original source fields |
| `English` / `Myanmar` / `Thai` / `Korean` | Remap `title` and `content` from the matching columns when present |

### Examples

```bash
curl -s "http://localhost:3000/api/news?lang=Myanmar"
curl -s "http://localhost:3000/api/news/<uuid>?lang=Thai"
```

## Admin create

`createNewsAction` requires `GOOGLE_TRANSLATE_API_KEY`. On failure: `{ "error": "…" }` and no insert.
