# Guide: About Us multilang (App Content)

## Prerequisites

1. No migration required (content lives in existing `app_content_section` jsonb).
2. For English auto-translate: set `GOOGLE_TRANSLATE_API_KEY` in `.env.local`.

## Use end-to-end

1. Go to **Admin → Settings → App Content**.
2. Open the **About us** tab.
3. Keep **Language = English**, fill Section heading, Story, Company name, and Contact address.
4. Click **Save** — Myanmar, Thai, and Korean are filled automatically when English is detected.
5. Optionally switch Language to review/edit a translation, then Save again (does not re-translate from English).
6. Mobile: `GET /api/mobile/about-us?lang=Myanmar`.

## Extending

- New locale: add `*Xx` fields to `aboutUsContentSchema` + defaults + `AboutUsTab` suffix map + targets in `localize-about-us.ts`.
- Translate another field: add it to `FIELDS` in `localize-about-us.ts` and bind it in `AboutUsTab`.

## Common errors

| Error | Fix |
| --- | --- |
| Save error about `GOOGLE_TRANSLATE_API_KEY` | Add the key, or save while not on English / with empty English texts |
| Mobile shows English for `?lang=Myanmar` | Empty MY fields fall back to English — re-save About Us from English to translate |
| Old content missing translations | Open About us, set Language = English, Save once |
