# Guide: Auto-translate product descriptions (Google Translate)

## Prerequisites

```bash
# .env.local
GOOGLE_TRANSLATE_API_KEY=your-key
```

Enable **Cloud Translation API** in Google Cloud Console. Apply migration:

```bash
npm run db:migrate
# If history is empty on an existing DB:
npx tsx scripts/baseline-drizzle-migrations.ts --until 0078_dear_smiling_tiger
npm run db:migrate
```

## Create (admin)

1. Open **Admin → Products → New**.
2. Enter a description in English, Myanmar, Thai, or Korean.
3. On save, the server detects the language and fills the other three locales.
4. Requires `GOOGLE_TRANSLATE_API_KEY` when description is non-empty.

## Edit (admin)

1. Open a product for edit.
2. Use the **Language** dropdown under Notes & description.
3. Edit that locale’s description and save — only that locale (and canonical `description` if it is the source language) is updated.
4. Other locales are **not** re-translated.

## API create

`POST /api/products` behaves the same as admin create for description localization. See [docs/api/products.md](../api/products.md).

## How to extend

- Prefer `pickLocalizedDescription` / `localizedDescriptionFieldsForLanguage` from `features/products/services/localize-description.ts`.
- Reuse news Google helpers — do not duplicate HTTP/translate logic.

## Common errors

| Error | Fix |
|-------|------|
| `Google Translate is not configured…` | Set key and restart |
| `Google Translate failed (403)` | Enable Translation API / billing |
| Create without description | OK — localization skipped |
