# Guide: Auto-translate articles (Google Translate)

## Prerequisites

```bash
# .env.local
GOOGLE_TRANSLATE_API_KEY=your-key
```

Enable **Cloud Translation API** in Google Cloud Console.

```bash
npm run db:push
# or npm run db:migrate
```

Restart `npm run dev`.

## Create article

1. Admin → Articles → New.
2. Enter title + body in any of EN / Myanmar / Thai / Korean.
3. Save draft or Publish.

The server detects the title language and fills `language`, `titleEn/My/Th/Ko`, and `contentEn/My/Th/Ko`.

## Edit article (per-language)

1. Open an existing article.
2. Use the **Language** dropdown (English / Myanmar / Thai / Korean).
3. Title and content switch to that locale’s stored values.
4. Edit and save — only that language’s columns are updated.
5. Editing the **source** language also updates canonical `title` / `content` (and may regenerate `slug`).
6. Autosave uses the same `editLanguage` mapping.

## Mobile

```bash
curl "http://localhost:3000/api/articles?lang=Thai"
curl "http://localhost:3000/api/articles/<id>?lang=Korean"
```

## Extend

- Adding a locale: extend `NEWS_LANGUAGES` in `features/news/services/google-translate.ts`, add Drizzle columns on `articles` and `news`, update `localizedFieldsForLanguage` / pick helpers, and regenerate migrations.
- Reuse the same Google helpers as news — do not duplicate translate logic under `features/articles/`.

## Errors

| Message | Fix |
|---------|-----|
| `Google Translate is not configured…` | Set key and restart |
| `column "content_en" does not exist` (on articles) | `npm run db:push` or migrate `0077` |
| `Google Translate failed (403)` | Enable Translation API / check key |
