# Guide: Auto-translate product titles & descriptions (Google Translate)

## Prerequisites

```bash
# .env.local
GOOGLE_TRANSLATE_API_KEY=your-key
```

Enable **Cloud Translation API** in Google Cloud Console. Apply migrations:

```bash
npm run db:migrate
# Includes 0079 (description) and 0080 (title) translation columns.
```

## Create (admin)

1. Open **Admin → Products → New**.
2. Enter a **title** (and optional description) in English, Myanmar, Thai, or Korean.
3. On save, the server detects the **title** language, fills `titleEn/My/Th/Ko`, sets `product.language`, and (if description is set) fills `descriptionEn/My/Th/Ko`.
4. Requires `GOOGLE_TRANSLATE_API_KEY` (title always triggers translation).

## Edit (admin)

1. Open a product for edit.
2. Use the **Language** dropdown under **Basic info**.
3. Edit that locale’s **title** and/or **description**, then save — only that locale (and canonical `title` / `description` if it is the source language) is updated.
4. Other locales are **not** re-translated.

## API create

`POST /api/products` behaves the same as admin create for title + description localization. See [docs/api/products.md](../api/products.md).

## How to extend

- Prefer `pickLocalizedTitle` / `pickLocalizedDescription` / `localizedTitleFieldsForLanguage` / `localizedDescriptionFieldsForLanguage` from `features/products/services/localize-description.ts`.
- Reuse news Google helpers — do not duplicate HTTP/translate logic.

## Common errors

| Error | Fix |
|-------|------|
| `Google Translate is not configured…` | Set key and restart |
| `Google Translate failed (403)` | Enable Translation API / billing |
| Create without description | OK — description localization skipped; title still translates |
