# Guide: Global FCM topic (Flutter + backend)

## Flutter (app startup, no login)

```dart
import 'package:firebase_messaging/firebase_messaging.dart';

Future<void> subscribeToGlobalTopic() async {
  await FirebaseMessaging.instance.subscribeToTopic('global');
}
```

Call from `main()` or your app initializer after Firebase is initialized.

## Handle notification tap navigation

```dart
void handleNotificationData(Map<String, dynamic> data) {
  final screen = data['screen'] as String?;
  switch (screen) {
    case 'article':
      final id = data['articleId'] as String?;
      if (id != null) navigator.push(ArticleDetailRoute(id: id));
      break;
    case 'news':
      final id = data['newsId'] as String?;
      if (id != null) navigator.push(NewsDetailRoute(id: id));
      break;
    case 'home':
    default:
      navigator.pushNamed('/home');
  }
}

// Foreground / background tap
FirebaseMessaging.onMessageOpenedApp.listen((m) {
  handleNotificationData(m.data);
});
```

Also handle `getInitialMessage()` for cold start.

## Backend env

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

## Admin: send custom broadcast

```bash
curl -X POST http://localhost:3000/api/admin/push/global \
  -H "Cookie: <admin-session>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Maintenance tonight",
    "body": "App may be unavailable 2–4 AM",
    "screen": "home"
  }'
```

Article deep link:

```json
{
  "title": "Featured read",
  "body": "Tap to open",
  "screen": "article",
  "articleId": "uuid-here"
}
```

## Automatic pushes

- **Article** published (admin panel) → global topic, `data.articleId` set.
- **News** published → global topic, `data.newsId` set.

## Common errors

| Symptom | Fix |
|---------|-----|
| No devices receive push | Confirm Flutter subscribed to `global`; check Firebase project matches backend env |
| 503 from admin API | Set `FIREBASE_*` in `.env.local` |
| Tap does nothing | Read `message.data` (not `notification` only) in Flutter |
