# GET /api/mobile/follow-us

**Auth:** Public — no session required.

**Request:** No params.

**Response (200):**

```json
{
  "platforms": [
    {
      "iconKey": "facebook",
      "customIconUrl": null,
      "label": "Facebook",
      "value": "facebook.com/gemx.app",
      "url": "https://facebook.com/gemx.app"
    }
  ]
}
```

Only platforms with `isActive: true` in the published content are returned, sorted by `sortOrder`. Empty array if never published or nothing is active.

**Errors:** `500` on an unexpected DB error, `{ "error": "Failed to load follow us content" }`.

**Example:**

```bash
curl https://gemx.app/api/mobile/follow-us
```

**Mobile flag:** Yes — consumed by the mobile app's Follow Us screen.
