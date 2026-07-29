# PATCH /api/mobile/premium-dealers/auto-renew

**Auth:** Bearer token (session required). `Authorization: Bearer <session_token>`.

**Request:**

Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`

Body (validated by `bodySchema` in `app/api/mobile/premium-dealers/auto-renew/route.ts`):

```json
{ "autoRenew": false }
```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `autoRenew` | boolean | Yes | New auto-renew value to apply to the caller's active subscription. |

**Response (200):**

```json
{ "success": true, "autoRenew": false }
```

**Errors:**

- `401` — `{ "error": "Unauthorized" }` — no valid session.
- `400` — `{ "error": "Invalid input" }` — `autoRenew` missing or not a boolean.
- `400` — `{ "error": "No active premium dealer subscription" }` — caller has no active, non-expired row in `premium_dealers_packages`.
- `500` — `{ "error": "Failed to update auto-renew" }` — unexpected server/DB error.

**Example:**

```bash
curl -X PATCH https://gemx.app/api/mobile/premium-dealers/auto-renew \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"autoRenew": false}'
```

```json
{ "success": true, "autoRenew": false }
```

**Mobile flag:** Yes — consumed by the "Become Premium" screen's auto-renew pill when the user is already premium.
