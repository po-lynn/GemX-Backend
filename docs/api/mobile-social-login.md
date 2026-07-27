# POST /api/mobile/social-login

Replaces the earlier `POST /api/mobile/google-login`. Generic by `provider`, but only `"google"` is wired/verified today.

**Auth:** Public — no session required (this endpoint issues one).

**Request:**

```json
{
  "provider": "google",
  "idToken": "<Google ID token from the native Sign-In SDK>",
  "fcmToken": "optional FCM device token",
  "platform": "android | ios",
  "deviceId": "optional",
  "deviceName": "optional",
  "deviceModel": "optional",
  "osVersion": "optional",
  "appVersion": "optional",

  "name": "optional",
  "country": "optional",
  "state": "optional",
  "city": "optional",
  "address": "optional",
  "gender": "optional",
  "dateOfBirth": "optional",
  "nrc": "optional",
  "nrcFrontUrl": "optional",
  "nrcBackUrl": "optional",
  "selfieUrl": "optional",
  "businessLicenseUrl": "optional"
}
```

`provider` must be one of the supported providers (currently just `"google"`) — anything else returns **400** before the request ever reaches better-auth. Facebook is not wired yet: its native SDK returns an `accessToken`, not an ID token/JWT, so it needs a different request shape and a verified `signInSocial` call before it can be added to the allow-list (see `docs/guides/social-login.md`).

`idToken` is the ID token the mobile app already obtained on-device from Google Sign-In (Android/iOS native SDK), configured with the backend's Google **Web application** OAuth client as the `webClientId`/"server client ID" so the token's audience matches `GOOGLE_CLIENT_ID`. This route does not perform a redirect-based OAuth flow — the token is verified server-side by better-auth (signature, issuer, audience, 1h max age).

**Profile fields (`name` through `businessLicenseUrl`)** — all optional, all inherited from the same Screen‑1 signup form Myanmar phone registration collects (`POST /api/mobile/register`). They let a non-Myanmar user complete signup in one call instead of a separate `PATCH /api/mobile/profile` round trip:
- Written to the `user` row **only when this call creates a brand-new user** (response 201). A returning login (response 200) never has these fields touched, even if the client resends stale form data — profile edits for an existing user go through `PATCH /api/mobile/profile` instead.
- `nrc` doubles as a passport/national ID for non-Myanmar users. It is validated against the Myanmar NRC format (Latin transliteration `12/ABC(N)123456` or the Myanmar script equivalent) **only when `country` is Myanmar or omitted**; for any other `country` it is stored as-is with no format check.
- An invalid Myanmar NRC returns **400** before the idToken is ever verified. An NRC that collides with another account's (unique constraint) returns **409** — this can happen after `signInSocial` already succeeded, since the profile write is a second step; the session was still created, only the profile fields failed to save.

**Response (200 — existing user / login):**

```json
{
  "redirect": false,
  "token": "<session_token>",
  "user": { "id": "...", "email": "...", "name": "...", "role": "user", "...": "..." }
}
```

**Response (201 — first-time sign-in / registration):** same shape as 200. A brand-new user is created (via better-auth's admin plugin, `role` defaults to `"user"`), credited the configured registration bonus (`creditDefaultRegistrationPointsToUser`), sent a welcome push instead of a login push, and has any provided profile fields written in the same request.

Store the **`token`** field exactly as with `/api/mobile/login` and use it as `Authorization: Bearer <token>` on subsequent requests.

**Errors:**
- **400** – `{ "error": "idToken is required" }`
- **400** – `{ "error": "Unsupported provider. Supported: google" }`
- **400** – `{ "error": "Invalid NRC format. Expected format: 12/ABC(N)123456 or the Myanmar script equivalent" }`
- **409** – `{ "error": "This NRC number is already registered to another account." }`
- **500** – `{ "error": "Account created, but saving profile details failed." }` — sign-in succeeded but the profile-field write hit an unexpected DB error; the account and session are valid, retry the profile fields via `PATCH /api/mobile/profile`.
- **401** – `{ "error": "Social sign-in failed" }` — invalid/expired token, audience mismatch, or any other verification failure. Message is intentionally generic (avoids leaking which check failed).
- **429** – `{ "error": "Too many login attempts. Please try again later." }` with `Retry-After` header — same 10-per-15-minutes limit as `/api/mobile/login`.

**Account linking:** If the Google account's email matches an existing user (e.g. a web/admin account created with that email), better-auth auto-links the Google identity to that existing user rather than creating a duplicate, since Google-verified emails are trusted (`account.accountLinking.trustedProviders: ["google"]` in `lib/auth.ts`). Mobile accounts created via phone/password use a synthetic internal email, so this only matters for accounts that already have a real email on file.

**Example:**

```bash
curl -X POST https://gemx.app/api/mobile/social-login \
  -H "Content-Type: application/json" \
  -d '{"provider":"google","idToken":"<google-id-token>","fcmToken":"fcm-abc","platform":"android","country":"Others","address":"123 Main St"}'
```

**Mobile flag:** Yes — mobile-only endpoint for native social sign-in.
