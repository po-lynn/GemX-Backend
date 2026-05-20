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

## Flutter example

```dart
// On chat screen open
Timer.periodic(Duration(seconds: 30), (_) async {
  await http.put(
    Uri.parse('$baseUrl/api/chat/viewing'),
    headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
    body: jsonEncode({'peerId': peerUserId}),
  );
});

// On dispose / back
await http.delete(
  Uri.parse('$baseUrl/api/chat/viewing'),
  headers: {'Authorization': 'Bearer $token'},
);

// Notification tap
void onNotificationTap(Map<String, dynamic> data) {
  if (data['screen'] == 'chat' && data['senderId'] != null) {
    navigator.push(ChatRoute(userId: data['senderId']));
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
