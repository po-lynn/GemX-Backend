# POST /api/mobile/google-login

**Auth:** Public — no session required (this endpoint issues one).

**Request:**

```json
{
  "idToken": "<Google ID token from the native Sign-In SDK>",
  "fcmToken": "optional FCM device token",
  "platform": "android | ios",
  "deviceId": "optional",
  "deviceName": "optional",
  "deviceModel": "optional",
  "osVersion": "optional",
  "appVersion": "optional"
}
```

`idToken` is the ID token the mobile app already obtained on-device from Google Sign-In (Android/iOS native SDK), configured with the backend's Google **Web application** OAuth client as the `webClientId`/"server client ID" so the token's audience matches `GOOGLE_CLIENT_ID`. This route does not perform a redirect-based OAuth flow — the token is verified server-side by better-auth (signature, issuer, audience, 1h max age).

**Response (200 — existing user / login):**

```json
{
  "redirect": false,
  "token": "<session_token>",
  "user": { "id": "...", "email": "...", "name": "...", "role": "user", "...": "..." }
}
```

**Response (201 — first-time Google sign-in / registration):** same shape as 200. A brand-new user is created (via better-auth's admin plugin, `role` defaults to `"user"`), credited the configured registration bonus (`creditDefaultRegistrationPointsToUser`), and sent a welcome push instead of a login push.

Store the **`token`** field exactly as with `/api/mobile/login` and use it as `Authorization: Bearer <token>` on subsequent requests.

**Errors:**
- **400** – `{ "error": "idToken is required" }`
- **401** – `{ "error": "Google sign-in failed" }` — invalid/expired token, audience mismatch, or any other verification failure. Message is intentionally generic (avoids leaking which check failed).
- **429** – `{ "error": "Too many login attempts. Please try again later." }` with `Retry-After` header — same 10-per-15-minutes limit as `/api/mobile/login`.

**Account linking:** If the Google account's email matches an existing user (e.g. a web/admin account created with that email), better-auth auto-links the Google identity to that existing user rather than creating a duplicate, since Google-verified emails are trusted (`account.accountLinking.trustedProviders: ["google"]` in `lib/auth.ts`). Mobile accounts created via phone/password use a synthetic internal email, so this only matters for accounts that already have a real email on file.

**Example:**

```bash
curl -X POST https://gemx.app/api/mobile/google-login \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<google-id-token>","fcmToken":"fcm-abc","platform":"android"}'
```

**Mobile flag:** Yes — mobile-only endpoint for native Google Sign-In.
