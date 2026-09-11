# Guide: Terms & Conditions (App Content)

## Prerequisites

1. Apply migration `0091_terms_conditions_section.sql`:

```bash
npm run db:migrate
```

Or in SQL:

```sql
ALTER TYPE "public"."app_content_section_name" ADD VALUE IF NOT EXISTS 'terms_conditions';
```

2. For English auto-translate: set `GOOGLE_TRANSLATE_API_KEY` in `.env.local`.

## Use end-to-end

1. Go to **Admin → Settings → App Content**.
2. Open the **Terms & Conditions** tab (beside Help & Support).
3. Keep **Language = English**, write the terms in BlockNote.
4. Click **Save** — Myanmar, Thai, and Korean are filled automatically when the English body is detected as English.
5. Optionally switch Language to review/edit a translation, then Save again (does not re-translate from English).
6. Mobile: `GET /api/mobile/terms-conditions?lang=Myanmar`.

## Extending

- New locale: add a `contentXx` field to the Zod schema + defaults + tab switcher + translate target list in `localize-terms.ts`.
- New section: follow `docs/guides/app-content-admin.md` (“Add a new section”).

## Common errors

| Error | Fix |
| --- | --- |
| `invalid input value for enum app_content_section_name` | Run migration 0091 |
| Save error about `GOOGLE_TRANSLATE_API_KEY` | Add the key, or save while not on English / with empty English body |
| Mobile returns `"[]"` | Save Terms from admin (Save goes live immediately) |
