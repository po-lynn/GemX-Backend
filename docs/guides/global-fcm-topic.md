# Guide: Global FCM topic (React Native + backend)

## React Native (app startup, no login)

```js
import messaging from '@react-native-firebase/messaging';

async function subscribeToGlobalTopic() {
  await messaging().subscribeToTopic('global');
}
```

Call during app initialization after Firebase is initialized.

## Handle notification tap navigation

```js
function handleNotificationData(data) {
  switch (data.screen) {
    case 'article':
      if (data.articleId) navigation.navigate('ArticleDetail', { id: data.articleId });
      break;
    case 'news':
      if (data.newsId) navigation.navigate('NewsDetail', { id: data.newsId });
      break;
    case 'home':
    default:
      navigation.navigate('Home');
  }
}

// Foreground / background tap
messaging().onNotificationOpenedApp(remoteMessage => {
  handleNotificationData(remoteMessage.data);
});
```

Also handle `getInitialNotification()` for cold start.

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
| No devices receive push | Confirm the app subscribed to `global`; check Firebase project matches backend env |
| 503 from admin API | Set `FIREBASE_*` in `.env.local` |
| Tap does nothing | Read `remoteMessage.data` (not `notification` only) in the app |
