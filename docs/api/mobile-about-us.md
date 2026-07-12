# GET /api/mobile/about-us

**Auth:** Public — no session required.

**Request:** No params.

**Response (200):**

```json
{
  "storyHeading": "Our Story",
  "storyBody": "GemX began in 2019...",
  "termsSlug": "terms",
  "termsUpdatedAt": "2026-03-12T00:00:00.000Z",
  "privacySlug": "privacy",
  "privacyUpdatedAt": "2026-03-12T00:00:00.000Z",
  "companyName": "GemX Technologies Ltd.",
  "contactAddress": "No. 12, Kabar Aye Pagoda Road, Yangon, Myanmar",
  "appVersion": "v2.4.1"
}
```

If the section has never been published, fields fall back to their configured defaults (`storyHeading` defaults to `"Our Story"`; `storyBody`, `termsSlug`, `privacySlug`, `companyName`, `contactAddress`, and `appVersion` default to empty strings) and the `*UpdatedAt` fields are `null` — the response is still `200`.

**Errors:** `500` on an unexpected DB error, `{ "error": "Failed to load about us content" }`.

**Example:**

```bash
curl https://gemx.app/api/mobile/about-us
```

**Mobile flag:** Yes — consumed by the mobile app's About screen.
