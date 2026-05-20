# Guide: FCM login & register notifications

## Prerequisites

1. Firebase project with Cloud Messaging enabled.
2. Service account JSON → set in `.env.local`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

3. Apply database migration:

```bash
npm run db:migrate
# or dev: npm run db:push
```

4. (Optional) Migrate legacy tokens:

```bash
psql $DATABASE_URL -f scripts/migrate-push-device-token-to-user-devices.sql
```

## Mobile: register with device + welcome push

```bash
curl -X POST http://localhost:3000/api/mobile/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "09123456789",
    "password": "your-password",
    "name": "Aung",
    "fcmToken": "<FCM_TOKEN>",
    "platform": "android",
    "deviceName": "Pixel 8",
    "deviceModel": "Google Pixel 8",
    "osVersion": "14",
    "appVersion": "1.2.0"
  }'
```

After success, the backend upserts `user_devices` and sends a **welcome** notification to all of that user's devices.

## Mobile: login with device + login alert

```bash
curl -X POST http://localhost:3000/api/mobile/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "09123456789",
    "password": "your-password",
    "fcmToken": "<FCM_TOKEN>",
    "platform": "ios",
    "deviceName": "iPhone 15"
  }'
```

Sends a **login alert** push to the user's registered devices.

## Register token later (authenticated)

```bash
curl -X POST http://localhost:3000/api/push/register \
  -H "Authorization: Bearer <session_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<FCM_TOKEN>",
    "platform": "android",
    "deviceId": "stable-device-uuid",
    "deviceName": "My Phone"
  }'
```

## Send custom push from server code

```typescript
import { sendPushNotificationToUserIds } from "@/features/notifications/services/send-push-notification";

await sendPushNotificationToUserIds(["user-id"], {
  title: "Order shipped",
  body: "Your item is on the way.",
  data: { screen: "orders", orderId: "123" },
});
```

## Extend: new notification type

1. Add a function in `features/notifications/services/` (or call `sendPushNotification` directly).
2. Import from your API route or feature action.
3. Use `data.type` in the mobile app for routing.

## Common errors

| Issue | Fix |
|-------|-----|
| No push received | Confirm `FIREBASE_*` env; check server logs for "Push skipped" |
| `user_devices` does not exist | Run `npm run db:migrate` |
| Duplicate token conflict | Same FCM token cannot belong to two users; re-register after logout |
| PEM / private key errors | Use escaped `\n` in `.env` or wrap key in quotes per README |
