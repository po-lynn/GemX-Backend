# FCM auth notifications (login / register)

## What changed

| Path | Change |
|------|--------|
| `drizzle/schema/user-devices-schema.ts` | New `user_devices` table with FCM token + device metadata |
| `drizzle/migrations/0037_user_devices.sql` | Migration for `user_devices` |
| `features/notifications/` | Clean-architecture module: types, Firebase admin, DB, schemas, services |
| `features/push/send-push.ts` | Thin wrapper over `sendPushNotification*` |
| `features/push/db/push-tokens.ts` | Delegates to `user_devices` |
| `app/api/mobile/login/route.ts` | Saves device + sends login push |
| `app/api/mobile/register/route.ts` | Saves device + sends welcome push |
| `app/api/push/register/route.ts` | Extended device fields; uses `user_devices` |
| `scripts/migrate-push-device-token-to-user-devices.sql` | Copy legacy `push_device_token` rows |

## Data flow

```
Mobile login/register (optional fcmToken + device fields)
  → mobileDevicePayloadSchema (Zod)
  → handleAuthDeviceAndNotifications
      → upsertUserDevice (user_devices)
      → sendWelcomeNotification | sendLoginNotification
          → sendPushNotificationToUserIds
              → getFcmTokensByUserIds
              → sendPushNotification (Firebase Admin multicast)
```

Standalone token registration (after auth):

```
POST /api/push/register (Bearer)
  → registerDeviceBodySchema
  → upsertUserDevice
```

## Schema impact

**New table: `user_devices`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | text FK → `user.id` | cascade delete |
| `fcm_token` | text | unique per user + globally unique |
| `platform` | text | `android` \| `ios` |
| `device_id` | text | client-stable id |
| `device_name` | text | e.g. "John's iPhone" |
| `device_model` | text | |
| `os_version` | text | |
| `app_version` | text | |
| `last_active_at` | timestamptz | updated on each upsert |
| `created_at`, `updated_at` | timestamptz | |

Legacy `push_device_token` remains in DB; new writes go to `user_devices`. Run `scripts/migrate-push-device-token-to-user-devices.sql` once to copy existing tokens.

## Auth & permissions

- Login/register device + push: no auth on route; uses user id from Better Auth response.
- `POST/DELETE /api/push/register`: Bearer session required.
- Sending push: server-only via Firebase Admin service account (`FIREBASE_*` env).

## Edge cases

- If `FIREBASE_*` env is unset, device rows are still saved; push is skipped (logged).
- Welcome/login push only deliver if the user has at least one FCM token (provided in the same request or registered earlier).
- Invalid FCM tokens are removed from `user_devices` after failed multicast responses.
- Multiple devices per user: one row per `(user_id, fcm_token)`; global unique on `fcm_token`.
- Auth notifications run in the background (`void`) so login/register responses are not delayed.
