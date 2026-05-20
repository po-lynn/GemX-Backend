# API: Global topic subscription (no auth)

## POST `/api/push/global/subscribe`

Register an FCM device token on the **`global`** topic. Used by the **web** app after `getToken()`; Flutter may use client `subscribeToTopic` instead.

**Auth:** None

### Request

```json
{ "token": "<fcm_registration_token>" }
```

### Success `200`

```json
{
  "success": true,
  "topic": "global",
  "successCount": 1,
  "failureCount": 0
}
```

### Errors

| Status | When |
|--------|------|
| `400` | Missing/invalid token |
| `502` | Firebase subscribe error |
| `503` | `FIREBASE_*` not configured |

### Example

```bash
curl -X POST http://localhost:3000/api/push/global/subscribe \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_FCM_WEB_TOKEN"}'
```

## DELETE `/api/push/global/subscribe`

Unsubscribe token from `global`. Body: `{ "token": "..." }`.
