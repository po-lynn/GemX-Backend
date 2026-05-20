# Guide: Web push (React) + global FCM topic

## Overview

The Next.js site initializes **web push** on load via `GlobalPushProvider` in `app/layout.tsx`. No user login is required.

Flow:

1. Browser requests notification permission automatically
2. Firebase Web SDK obtains an FCM token (VAPID)
3. Token is registered to topic `global` via `POST /api/push/global/subscribe`
4. When admin publishes an article, backend sends to topic `global`
5. User taps notification → `/articles/[articleId]` or `/news/[newsId]`

## Environment variables

Copy from Firebase Console → Project settings → Web app + Cloud Messaging:

```env
# Server (Admin SDK)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Web client
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
```

Run `npm install` after pulling (adds `firebase` client SDK).

## Reusable client service

```typescript
import { getWebPushNotificationService } from "@/lib/notifications/web-push-service";

const service = getWebPushNotificationService();
const result = await service.initialize((payload) => {
  console.log("Foreground message", payload.data);
});
```

## Article / news notification payload

| FCM `data` key | Example |
|----------------|---------|
| `screen` | `article` or `news` |
| `articleId` / `newsId` | UUID |
| `articleTitle` / `newsTitle` | Headline |
| `link` | `/articles/{id}` or `/news/{id}` |

Notification `title` / `body` are also set for the system tray. Admin publish of news triggers the same global topic flow as articles.

## Files

| Path | Role |
|------|------|
| `lib/notifications/web-push-service.ts` | Reusable `WebPushNotificationService` |
| `components/notifications/GlobalPushProvider.tsx` | React provider (app load) |
| `public/firebase-messaging-sw.js` | Background + click handler |
| `app/api/push/global/subscribe/route.ts` | Topic subscribe (no auth) |
| `app/articles/[id]/page.tsx` | Article detail destination |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Permission blocked | Reset site permissions in browser settings |
| No token | Ensure HTTPS (or localhost) and valid VAPID key |
| 503 on subscribe | Set server `FIREBASE_*` Admin credentials |
| Click opens wrong page | Verify `data.screen` and `data.articleId` in payload |
