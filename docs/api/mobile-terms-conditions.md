# GET /api/mobile/terms-conditions

**Auth:** Public — no session required.

**Mobile flag:** Yes — Terms & Conditions screen.

**Query**

| Param | Type | Notes |
| --- | --- | --- |
| `lang` | string | Optional. `English`/`en`, `Myanmar`/`my`, `Thai`/`th`, `Korean`/`ko`. Remaps `content` to that locale (falls back to English). |

**Response (200):**

```json
{
  "content": "[{\"type\":\"paragraph\",...}]",
  "contentEn": "[...]",
  "contentMy": "[...]",
  "contentTh": "[...]",
  "contentKo": "[...]",
  "sourceLanguage": "English",
  "lang": "Myanmar"
}
```

`content` is BlockNote JSON. Prefer `content` + `lang`, or pick `contentEn` / `contentMy` / `contentTh` / `contentKo` directly.

If never published, locales default to `"[]"` and still return **200**.

**Errors:** `500` → `{ "error": "Failed to load terms & conditions" }`.

**Example:**

```bash
curl "https://gemx.app/api/mobile/terms-conditions?lang=Myanmar"
```
