# Chat message push notifications

## What changed

| Path | Change |
|------|--------|
| `features/notifications/services/chat-notifications.ts` | `sendChatMessageNotification()` |
| `features/notifications/payloads/chat.ts` | FCM data builder |
| `features/chat/db/active-chat-view.ts` | Viewing state + TTL check |
| `features/chat/lib/conversation-id.ts` | `getDirectConversationId()` |
| `drizzle/schema/chat-active-view-schema.ts` | `user_active_chat_view` table |
| `app/api/chat/viewing/route.ts` | PUT/DELETE viewing heartbeat |
| `app/api/chat/messages/route.ts` | Uses chat notification service |

## Data flow

```
POST /api/chat/messages (sender authenticated)
  → insert messages row
  → sendChatMessageNotification({ recipientId, senderId, messageId, preview })
      → isUserViewingPeer(recipientId, senderId)? → skip
      → getFcmTokensByUserIds([recipientId]) from user_devices
      → sendPushNotification (Firebase Admin multicast)
```

Device tokens: **POST /api/push/register** after login → `user_devices` (multi-device).

## Suppress push when viewing same chat

`user_active_chat_view`: one row per user (`user_id` PK), `peer_id`, `conversation_id`, `updated_at`.

- **PUT /api/chat/viewing** upserts heartbeat.
- **DELETE /api/chat/viewing** clears row.
- Push skipped if `peer_id === senderId` and `updated_at` within **90s**.

## Auth

- Send message: Bearer required.
- Viewing heartbeat: Bearer required.
- Push delivery: no auth (FCM to registered tokens).
