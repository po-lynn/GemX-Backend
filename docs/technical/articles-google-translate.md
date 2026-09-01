# Articles auto-translate via Google Translate

## What changed

On **create article**, the server detects the title language and translates **title + BlockNote content** into the other three locales (English, Myanmar, Thai, Korean) using **Google Cloud Translation API** (same helpers as news). All values are saved on the **`articles`** row.

### Files

| Path | Role |
|------|------|
| `drizzle/schema/articles-schema.ts` | `language`, `title*`, `content*` columns |
| `drizzle/migrations/0077_articles_translations.sql` | Added language + title_* + content_* |
| `features/articles/actions/articles.ts` | Create builds localized payload; update/autosave use `editLanguage` |
| `features/articles/components/ArticleForm.tsx` | Language dropdown on edit (parity with NewsForm) |
| `features/articles/hooks/useAutoSave.ts` | Passes `editLanguage` on autosave |
| `app/api/articles/route.ts` / `[id]/route.ts` | Optional `?lang=` remaps title/content |

## Data flow

```
ArticleForm (title, content)
  → createArticleAction
    → buildLocalizedNews(title, content)   // shared Google Translate helper
         detect from title → translate to other 3 langs
    → createArticleInDb({ language, title*, content* })
```

Edit:

```
Language dropdown → title/content for that locale
  → updateArticleAction / autoSaveArticleAction (editLanguage)
    → localizedFieldsForLanguage(...)
    → updateArticleInDb
```

## Schema impact

| Column | Notes |
|--------|--------|
| `language` | Source locale (default `English`) |
| `title_en/my/th/ko` | Localized titles |
| `content_en/my/th/ko` | Localized BlockNote JSON |

Existing rows: migration backfills `title_en`/`content_en` from canonical columns.

## Auth

Admin session (`canAdminManageArticles`) for create/update. Public `?lang=` on GET APIs.

## Limitations

- Missing `GOOGLE_TRANSLATE_API_KEY` → create fails (no row inserted).
- Edit does not re-translate; per-locale editing only.
- Slug regenerates only when canonical `title` changes (source-language edits).
