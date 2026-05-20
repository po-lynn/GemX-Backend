# API: Admin global push

## POST `/api/admin/push/global`

Broadcast a push notification to every device subscribed to the FCM topic **`global`**.

**Auth:** Admin session (cookie). Requires `role: admin`.

**Mobile:** Indirect — Flutter subscribes to `global` on startup; no Bearer token required to receive.

### Request body (`adminGlobalPushBodySchema`)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | Yes | Max 200 chars |
| `body` | string | No | Max 1000 chars |
| `screen` | enum | No | Default `home`. `article` \| `news` \| `profile` \| `product` \| `custom` \| `home` |
| `articleId` | uuid | If `screen=article` | Deep link |
| `newsId` | uuid | If `screen=news` | Deep link |
| `productId` | uuid | If `screen=product` | Deep link |
| `link` | string | No | Optional path hint |
| `data` | `Record<string,string>` | No | Extra FCM data keys |

### Success `200`

```json
{
  "success": true,
  "messageId": "projects/.../messages/0:...",
  "topic": "global"
}
```

### Errors

| Status | Body | When |
|--------|------|------|
| `400` | `{ "error": "..." }` | Validation failed |
| `401` | `{ "error": "Unauthorized" }` | No session |
| `403` | `{ "error": "Forbidden" }` | Not admin |
| `502` | `{ "error": "...", "code": "FCM_SEND_FAILED" }` | Firebase error |
| `503` | `{ "error": "...", "code": "FCM_NOT_CONFIGURED" }` | Missing env |
| `500` | `{ "error": "Failed to send..." }` | Unexpected |

### Example

```bash
curl -X POST http://localhost:3000/api/admin/push/global \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=..." \
  -d '{
    "title": "New collection",
    "body": "Browse today",
    "screen": "home"
  }'
```

### Automatic article / news payloads

When admin publishes content in the panel:

| Event | `data` keys |
|-------|-------------|
| Article published | `screen=article`, `type=article`, `articleId`, `link` |
| News published | `screen=news`, `type=news`, `newsId`, `link` |
