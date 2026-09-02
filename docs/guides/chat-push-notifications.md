# Guide: Chat message push notifications

## Flow

1. User logs in → **POST /api/push/register** with FCM `token` (saved in `user_devices`, multiple devices per user).
2. User opens chat with peer → **PUT /api/chat/viewing** `{ "peerId": "<peerUserId>" }` and repeat every ~30s while the screen is open.
3. User leaves chat → **DELETE /api/chat/viewing**.
4. Someone sends **POST /api/chat/messages** → receiver gets FCM unless step 2 is active for that peer.

## FCM payload (tap to open chat)

| Key | Description |
|-----|-------------|
| `screen` | `chat` |
| `type` | `chat_message` |
| `senderId` | Who sent the message (open chat with this user) |
| `conversationId` | Stable id for the 1:1 thread |
| `messageId` | Message UUID |
| `link` | `/chat/{senderId}` |

Notification **title** = sender name, **body** = message preview.

## React Native example

```js
// On chat screen open
const interval = setInterval(async () => {
  await fetch(`${baseUrl}/api/chat/viewing`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ peerId: peerUserId }),
  });
}, 30_000);

// On unmount / back
useEffect(() => {
  return () => {
    clearInterval(interval);
    fetch(`${baseUrl}/api/chat/viewing`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  };
}, []);

// Notification tap (via @react-native-firebase/messaging)
function onNotificationTap(data) {
  if (data.screen === 'chat' && data.senderId) {
    navigation.navigate('Chat', { userId: data.senderId });
  }
}
```

## Register device token

```bash
curl -X POST http://localhost:3000/api/push/register \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"token":"<fcm_token>","platform":"android"}'
```
