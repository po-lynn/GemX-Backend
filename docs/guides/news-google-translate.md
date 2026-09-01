# Guide: Auto-translate news (Google Translate)

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

## Create news

1. Admin → News → New.
2. Enter title + body in any of EN / Myanmar / Thai / Korean.
3. Save draft or Publish.

The server detects the title language and fills `language`, `titleEn/My/Th/Ko`, and `contentEn/My/Th/Ko`.

## Edit news (per-language)

1. Open an existing news item.
2. Use the **Language** dropdown (English / Myanmar / Thai / Korean).
3. Title and content switch to that locale’s stored values.
4. Edit and save — only that language’s columns are updated.
5. Editing the **source** language also updates canonical `title` / `content`.
6. Autosave uses the same `editLanguage` mapping.

## Mobile

```bash
curl "http://localhost:3000/api/news?lang=Thai"
curl "http://localhost:3000/api/news/<id>?lang=Korean"
```

## Errors

| Message | Fix |
|---------|-----|
| `Google Translate is not configured…` | Set key and restart |
| `column "content_en" does not exist` | `npm run db:push` |
| `Google Translate failed (403)` | Enable Translation API / check key |
