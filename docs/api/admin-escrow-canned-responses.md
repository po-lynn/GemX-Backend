# /api/admin/escrow-canned-responses

`GET` (list) and `POST` (create). Route file:
`app/api/admin/escrow-canned-responses/route.ts`.

**Mobile flag:** Not consumed by the mobile app — admin-only. `bodyMy` is
stored for a future buyer/seller-facing surface but nothing sends it to
mobile today.

---

## GET /api/admin/escrow-canned-responses

**Auth:** `requireAdminOrFeature(request, FEATURE_KEYS.ESCROW_CASES)` — the
same key that gates the case list/create routes and the
`/admin/messages/escrow` page itself; there is no separate settings key for
managing templates.

### Request

Query params:

| Param        | Type    | Default | Notes                                                              |
|--------------|---------|---------|------------------------------------------------------------------------|
| `activeOnly` | string  | `true`  | Any value other than the literal string `"false"` is treated as true |

The reply-box picker calls this with no query param (defaults to active-
only); the admin config page passes `activeOnly=false` so disabled
templates still show (and can be re-enabled).

### Response

`200 OK`:

```json
{
  "success": true,
  "responses": [
    {
      "id": "resp-1",
      "title": "Handover reminder",
      "bodyEn": "Please confirm the handover time.",
      "bodyMy": "လွှဲပြောင်းမည့်အချိန်ကို အတည်ပြုပေးပါ။",
      "isActive": true,
      "sortOrder": 0,
      "createdByAdminId": "usr_admin",
      "createdAt": "2026-09-16T00:00:00.000Z",
      "updatedAt": "2026-09-16T00:00:00.000Z"
    }
  ]
}
```

Ordered by `sortOrder` ascending, then `title` ascending.

#### Errors

| Status | Body                                             | Cause                          |
|--------|--------------------------------------------------------|-----------------------------------|
| 401    | `{ "error": "Unauthorized" }`                             | No session                          |
| 403    | `{ "error": "Forbidden" }`                                | Missing the `ESCROW_CASES` key      |
| 500    | `{ "error": "Failed to load canned responses" }`          | Unexpected server error             |

### Example

```bash
curl -s \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  "http://localhost:3000/api/admin/escrow-canned-responses?activeOnly=false"
```

---

## POST /api/admin/escrow-canned-responses

**Auth:** same as `GET` above.

### Request

Body — `createSchema`:

| Field       | Type   | Required | Constraint                     |
|-------------|--------|----------|------------------------------------|
| `title`     | string | yes      | `.trim().min(1).max(200)`            |
| `bodyEn`    | string | yes      | `.trim().min(1).max(2000)`           |
| `bodyMy`    | string | yes      | `.trim().min(1).max(2000)`           |
| `sortOrder` | number | no       | integer                              |

`createdByAdminId` is always the session user — never accepted from the
request body.

### Response

`200 OK`, same shape as one entry of `GET`'s `responses` array, under the
key `response`.

#### Errors

| Status | Body                                              | Cause                          |
|--------|---------------------------------------------------------|-----------------------------------|
| 400    | `{ "error": "Invalid input" }`                             | Missing/malformed body, or `bodyEn`/`bodyMy`/`title` empty or over their max length |
| 401    | `{ "error": "Unauthorized" }`                              | No session                          |
| 403    | `{ "error": "Forbidden" }`                                 | Missing the `ESCROW_CASES` key      |
| 500    | `{ "error": "Failed to create canned response" }`          | Unexpected server error             |

### Example

```bash
curl -s -X POST \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Handover reminder","bodyEn":"Please confirm the handover time.","bodyMy":"လွှဲပြောင်းမည့်အချိန်ကို အတည်ပြုပေးပါ။"}' \
  "http://localhost:3000/api/admin/escrow-canned-responses"
```
