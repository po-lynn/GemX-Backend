# GET /api/mobile/help-support

**Auth:** Public — no session required.

**Request:** No params.

**Response (200):**

```json
{
  "faqs": [{ "question": "How do I sell an item on GemX?", "answer": "Tap the + button..." }],
  "contact": { "email": "support@gemx.app", "phone": "+95 9 250 000 111", "telegram": "t.me/gemxsupport" },
  "hours": { "weekday": "9:00–18:00", "saturday": "10:00–15:00", "sunday": "Closed", "timezone": "Asia/Yangon (UTC+06:30)" },
  "reportForm": { "enabled": true, "categories": ["Bug", "Payment", "Fraud"], "allowScreenshots": true }
}
```

Only FAQs with `isActive: true` are returned, sorted by `sortOrder`.

**Errors:** `500` on an unexpected DB error, `{ "error": "Failed to load help & support content" }`.

**Example:**

```bash
curl https://gemx.app/api/mobile/help-support
```

**Mobile flag:** Yes — consumed by the mobile app's Help & Support screen.
