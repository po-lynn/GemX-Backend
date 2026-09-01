# News auto-translate via Google Translate

## What changed

On **create news**, the server detects the title language and translates **title + BlockNote content** into the other three locales (English, Myanmar, Thai, Korean) using **Google Cloud Translation API**. All values are saved on the **`news`** row.

### Files

| Path | Role |
|------|------|
| `drizzle/schema/news-schema.ts` | `language`, `title*`, `content*` columns |
| `drizzle/migrations/0074_bored_morg.sql` | Added language + title_* (already applied) |
| `drizzle/migrations/0075_news_content_translations.sql` | Added content_* |
| `features/news/services/google-translate.ts` | Detect + translate helpers |
| `features/news/actions/news.ts` | Create builds localized payload before insert |
| `app/api/news/route.ts` / `[id]/route.ts` | Optional `?lang=` remaps title/content |

## Data flow

```
NewsForm (title, content)
  → createNewsAction
    → buildLocalizedNews(title, content)
         Google /detect from title
         Google /translate title + BlockNote text fields → other 3 langs
    → createNewsInDb({ language, title*, content* })
```

## Schema

| Column | Notes |
|--------|--------|
| `language` | Source locale display name |
| `title_en/my/th/ko` | Localized titles |
| `content_en/my/th/ko` | Localized BlockNote JSON |

## Auth

Admin session (`canAdminManageNews`). API key stays server-side.

## Limitations

- Missing `GOOGLE_TRANSLATE_API_KEY` → create fails (no row inserted).
- Edit mode uses a language dropdown to edit each locale’s title/content independently (no re-translate on edit).
- Autosave / save with `editLanguage` updates only that locale’s columns (plus canonical `title`/`content` when editing the source language).
- BlockNote translation only rewrites `text` / `caption` string fields.
