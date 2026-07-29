# API: Contact us

## POST `/api/contact`

Public "Contact us" form submission from an anonymous website visitor (landing page `#contact` section).

**Auth:** None — public endpoint.

**Rate limit:** 5 requests / 60s per client IP (`x-forwarded-for`), in-memory (`lib/rate-limit.ts`).

**Mobile flag:** Not consumed by the mobile app — web landing page only.

**Side effect:** In addition to storing the submission in `contact_message`, this route best-effort delivers it as a chat message to the currently assigned escrow officer (**Admin → Settings → Escrow Service**), sent from a placeholder "Website Contact Form" account. If no officer is configured, or the chat delivery fails, the `200` response and `contact_message` row are unaffected — see `docs/technical/contact-form.md`.

### Request body (`bodySchema`)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | Trimmed, 1–200 chars |
| `email` | string | Yes | Trimmed, valid email, max 320 chars |
| `message` | string | Yes | Trimmed, 1–5000 chars |

### Success `200`

```json
{
  "success": true,
  "id": "b3f6...-uuid",
  "createdAt": "2026-07-28T10:47:06.000Z"
}
```

### Errors

| Status | Body | When |
|--------|------|------|
| `400` | `{ "error": "..." }` | Validation failed (first Zod issue message) |
| `429` | `{ "error": "Too many requests" }` | Rate limit exceeded (`Retry-After` header set) |
| `500` | `{ "error": "Failed to submit contact message" }` | Unexpected error |

### Example

```bash
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PO",
    "email": "po2g@gmail.com",
    "message": "Hello"
  }'
```
