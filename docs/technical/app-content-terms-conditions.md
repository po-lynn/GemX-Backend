# App Content — Terms & Conditions tab

## What changed

Added a fourth App Content section **Terms & Conditions** beside Help & Support:

| Path | Role |
| --- | --- |
| `drizzle/schema/app-content-schema.ts` | Enum value `terms_conditions` |
| `drizzle/migrations/0091_terms_conditions_section.sql` | `ALTER TYPE … ADD VALUE` |
| `features/app-content/schemas/app-content.ts` | `termsConditionsContentSchema` |
| `features/app-content/lib/localize-terms.ts` | EN → MY/TH/KO BlockNote translate |
| `features/app-content/components/TermsConditionsTab.tsx` | BlockNote + language switcher |
| `features/app-content/components/AppContentClient.tsx` | New tab `terms` |
| `app/api/mobile/terms-conditions/route.ts` | Public published read |

## Data flow

1. Admin opens **App Content → Terms & Conditions** (`?tab=terms`).
2. Edits BlockNote for a locale (default English).
3. **Save** (active Terms tab only) with English selected → `saveAppContentAction` sets `translateTermsFromEnglish: true` → detects language from EN body → if English, `translateBlockNoteContent` fills MY/TH/KO → upserts `terms_conditions` draft **and** published content (live for mobile).
4. Mobile `GET /api/mobile/terms-conditions?lang=` reads published jsonb.

## Schema impact

- DB enum `app_content_section_name` gains `terms_conditions` (migration 0091).
- JSON shape (no new columns):

```ts
{
  contentEn: string // BlockNote JSON
  contentMy: string
  contentTh: string
  contentKo: string
  sourceLanguage: "English" | "Myanmar" | "Thai" | "Korean"
}
```

## Auth & permissions

Same as other App Content tabs: page via `settings.app_content`; save/publish admin role only. Mobile route is public.

## Edge cases

- Empty English body: no translate call; locales stay as sent.
- Non-English detected in `contentEn`: skips auto-translate; stores `sourceLanguage` from detection.
- Missing `GOOGLE_TRANSLATE_API_KEY` when English translate is requested: save returns an error message.
- Editing MY/TH/KO only: `translateTermsFromEnglish` is false; other locales are not overwritten.
