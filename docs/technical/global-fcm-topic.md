# Global FCM topic push (no user auth)

## What changed

| Path | Purpose |
|------|---------|
| `features/notifications/constants.ts` | `FCM_GLOBAL_TOPIC = "global"` |
| `features/notifications/errors.ts` | Typed error codes + Firebase error normalization |
| `features/notifications/payloads/navigation.ts` | Click-navigation `data` builders |
| `features/notifications/services/send-topic-notification.ts` | `sendPushToTopic()` via Firebase Admin |
| `features/notifications/services/global-push.ts` | Article/news/admin global sends |
| `features/notifications/schemas/global-push.ts` | Admin API Zod schema |
| `app/api/admin/push/global/route.ts` | Admin broadcast endpoint |
| `features/articles/actions/articles.ts` | Uses global topic on publish |
| `features/news/actions/news.ts` | Uses global topic on publish |

## Data flow

```
Flutter startup
  → subscribeToTopic("global")   // no login required

Admin / publish hooks
  → sendGlobalPushNotification | sendArticlePublishedNotification | sendNewsPublishedNotification
  → sendPushToTopic("global", payload)
  → Firebase Admin messaging().send({ topic: "global", notification, data })
  → FCM → all subscribed devices

User taps notification
  → Flutter reads data.screen, data.articleId | data.newsId
  → navigates to detail screen
```

## FCM data contract (notification click)

| Key | Example | Purpose |
|-----|---------|---------|
| `type` | `article` | Same as screen; routing discriminator |
| `screen` | `article` \| `news` \| `home` \| … | Target screen |
| `articleId` | UUID | Article detail |
| `newsId` | UUID | News detail |
| `productId` | UUID | Product detail |
| `link` | `/articles/:id` | Optional path hint |

## Auth

- **Receiving:** no Bearer token; topic subscription only.
- **Sending:** admin session for `POST /api/admin/push/global`; article/news publish uses existing admin server actions.
- **User-targeted pushes** (chat, login) still use `user_devices` + token multicast.

## Edge cases

- Missing `FIREBASE_*` env → send returns `{ success: false, code: "FCM_NOT_CONFIGURED" }`; publish hooks log and continue.
- Topic messages do not return per-device failures; invalid subscriptions are handled client-side.
- Article/news push only fires when status becomes `published` (create or update).
