# GET /api/mobile/about-us

**Auth:** Public — no session required.

**Mobile flag:** Yes — consumed by the mobile app's About screen.

**Query**

| Param | Type | Notes |
| --- | --- | --- |
| `lang` | string | Optional. `English`/`en`, `Myanmar`/`my`, `Thai`/`th`, `Korean`/`ko`. Remaps `storyHeading`, `storyBody`, `companyName`, and `contactAddress` to that locale (falls back to English when empty). |

**Response (200):**

```json
{
  "storyHeading": "ကျွန်ုပ်တို့၏ဇာတ်လမ်း",
  "storyBody": "…",
  "companyName": "…",
  "contactAddress": "…",
  "storyHeadingEn": "Our Story",
  "storyHeadingMy": "ကျွန်ုပ်တို့၏ဇာတ်လမ်း",
  "storyHeadingTh": "",
  "storyHeadingKo": "",
  "storyBodyEn": "GemX began in 2019...",
  "storyBodyMy": "",
  "storyBodyTh": "",
  "storyBodyKo": "",
  "companyNameEn": "GemX Technologies Ltd.",
  "companyNameMy": "",
  "companyNameTh": "",
  "companyNameKo": "",
  "contactAddressEn": "No. 12, Kabar Aye Pagoda Road, Yangon, Myanmar",
  "contactAddressMy": "",
  "contactAddressTh": "",
  "contactAddressKo": "",
  "sourceLanguage": "English",
  "lang": "Myanmar",
  "termsSlug": "terms",
  "termsUpdatedAt": "2026-03-12T00:00:00.000Z",
  "privacySlug": "privacy",
  "privacyUpdatedAt": "2026-03-12T00:00:00.000Z",
  "appVersion": "v2.4.1"
}
```

Prefer `storyHeading` / `storyBody` / `companyName` / `contactAddress` + `lang`, or pick the `*En` / `*My` / `*Th` / `*Ko` fields directly. Slugs, dates, and `appVersion` are not translated.

If the section has never been published, English heading defaults to `"Our Story"`; other strings default to empty; `*UpdatedAt` fields are `null` — still **200**.

**Errors:** `500` on an unexpected DB error, `{ "error": "Failed to load about us content" }`.

**Example:**

```bash
curl "https://gemx.app/api/mobile/about-us?lang=Myanmar"
```
