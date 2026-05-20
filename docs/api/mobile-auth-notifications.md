# API: Mobile auth + FCM device registration

## POST `/api/mobile/register`

**Auth:** Public (no Bearer)

**Request body (Zod: inline + `mobileDevicePayloadSchema` for device fields)**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `phone` | string | Yes | Myanmar format `09…` |
| `password` | string | Yes | |
| `name` | string | No | Default `"Mobile User"` |
| `fcmToken` or `token` | string | No | FCM device token |
| `platform` | `"android"` \| `"ios"` | No | |
| `deviceId` | string | No | Stable client device id |
| `deviceName` | string | No | Used in login alert text |
| `deviceModel` | string | No | |
| `osVersion` | string | No | |
| `appVersion` | string | No | |
| `nrc`, `address`, `city`, `state`, `country`, `gender`, `dateOfBirth` | string | No | Profile fields |

**Side effects (async):**

- Upserts `user_devices` when `fcmToken`/`token` present
- Sends welcome push (`data.type: "welcome"`, `screen: "home"`)

**Response:** `201` — Better Auth sign-up payload with `role: "user"`

**Example:**

```bash
curl -X POST http://localhost:3000/api/mobile/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"09123456789","password":"secret","name":"Aung","fcmToken":"FCM_TOKEN","platform":"android"}'
```

---

## POST `/api/mobile/login`

**Auth:** Public

**Request body:** Same device fields as register, plus:

| Field | Type | Required |
|-------|------|----------|
| `phone` | string | Yes |
| `password` | string | Yes |

**Side effects (async):**

- Upserts `user_devices` when token provided
- Sends login alert push (`data.type: "login"`, `screen: "profile"`)

**Response:** `200` — Better Auth session + user

**Errors:** `400` invalid input, `401` invalid credentials

**Mobile:** Yes (`/api/mobile/*`)

---

## POST `/api/push/register`

**Auth:** Bearer session

**Request:** `registerDeviceBodySchema`

```json
{
  "token": "<fcm_token>",
  "platform": "android",
  "deviceId": "optional",
  "deviceName": "optional",
  "deviceModel": "optional",
  "osVersion": "optional",
  "appVersion": "optional"
}
```

**Response:** `200` `{ "success": true }`

**Errors:** `401` Unauthorized, `400` missing token, `500` server error

---

## DELETE `/api/push/register`

**Auth:** Bearer session

**Request:** `{ "token": "<fcm_token>" }`

**Response:** `200` `{ "success": true }`

**Mobile:** Yes — call on logout to remove device row.
