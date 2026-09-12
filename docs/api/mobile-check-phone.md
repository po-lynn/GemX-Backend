# POST /api/mobile/check-phone

**Auth:** Public — no session required.

**Mobile flag:** Yes — signup page phone availability check.

**Rate limit:** 30 requests / 15 minutes per IP.

## Request

```json
{ "phone": "09123456789" }
```

| Field | Required | Notes |
| --- | --- | --- |
| `phone` | Yes | Myanmar mobile: `09…` or `+959…` |

## Response (200)

```json
{
  "exists": true,
  "available": false,
  "phone": "+959123456789"
}
```

| Field | Meaning |
| --- | --- |
| `exists` | `true` if this phone is already registered |
| `available` | `!exists` — convenient for signup validation |
| `phone` | Normalized E.164 value used for the lookup |

## Errors

| Status | Body |
| --- | --- |
| 400 | `{ "error": "Phone must start with 09 (e.g. 09123456789)" }` |
| 429 | `{ "error": "Too many requests. Please try again later." }` (+ `Retry-After`) |
| 500 | `{ "error": "Failed to check phone number" }` |

## Example

```bash
curl -X POST https://gemx.app/api/mobile/check-phone \
  -H "Content-Type: application/json" \
  -d '{"phone":"09123456789"}'
```
