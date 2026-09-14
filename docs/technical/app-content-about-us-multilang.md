# App Content — About Us multilang

## What changed

About Us now stores EN/MY/TH/KO plain-text locales for four fields, matching the Terms & Conditions language workflow (admin Language select + Google Translate on English save).

| Path | Role |
| --- | --- |
| `features/app-content/schemas/app-content.ts` | `aboutUsContentSchema` multilang fields |
| `features/app-content/lib/localize-about-us.ts` | Normalize legacy jsonb; EN→MY/TH/KO; mobile pick |
| `features/app-content/db/app-content.ts` | Defaults + normalize on read |
| `features/app-content/actions/app-content.ts` | `localizeAboutUsIfEnglish` on save |
| `features/app-content/components/AboutUsTab.tsx` | Language select + locale-bound inputs |
| `features/app-content/components/AppContentClient.tsx` | `aboutEditLanguage` + `translateFromEnglish` |
| `app/api/mobile/about-us/route.ts` | Optional `?lang=` |

## Data flow

1. Admin opens **App Content → About us**.
2. Edits **Section heading**, **Story**, **Company name**, **Contact address** for the selected Language (default English).
3. **Save** while Language = English → `translateFromEnglish: true` → detect language from English texts → if English, `translateTexts` fills MY/TH/KO for those four fields → upserts draft **and** published (live for mobile).
4. Mobile `GET /api/mobile/about-us?lang=` returns localized `storyHeading` / `storyBody` / `companyName` / `contactAddress` plus all locale columns.

## Schema impact

No DB migration (jsonb only). Shape:

```ts
{
  storyHeadingEn/My/Th/Ko: string
  storyBodyEn/My/Th/Ko: string
  companyNameEn/My/Th/Ko: string
  contactAddressEn/My/Th/Ko: string
  sourceLanguage: "English" | "Myanmar" | "Thai" | "Korean"
  termsSlug, termsUpdatedAt, privacySlug, privacyUpdatedAt, appVersion // not translated
}
```

Legacy monolingual rows (`storyHeading`, `storyBody`, `companyName`, `contactAddress`) are migrated into `*En` on read via `normalizeAboutUsContent`.

## Auth & permissions

Same as other App Content tabs: admin role for save. Mobile route is public.

## Edge cases & known limitations

- Empty English texts: no translate call; locales stay as sent.
- Non-English detected in English fields: skips auto-translate; stores detected `sourceLanguage`.
- Missing `GOOGLE_TRANSLATE_API_KEY` when English translate is requested: save returns an error.
- Editing MY/TH/KO only: does not overwrite other locales.
- Slugs / app version are language-agnostic.
