# Google social sign-in (mobile)

## What changed

- `lib/auth.ts` — added `socialProviders.google` (verifies ID tokens against `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) and `account.accountLinking` (`enabled: true`, `trustedProviders: ["google"]`).
- `.env.example` — documented `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- `app/api/mobile/google-login/route.ts` — new mobile endpoint wrapping `auth.api.signInSocial` with the same rate-limiting, device registration, and welcome/login-notification conventions as `/api/mobile/login` and `/api/mobile/register`.
- `tests/api/mobile/google-login.test.ts` — new user vs existing user, missing token, verification failure, undecodable token.
- `docs/api/mobile-google-login.md`, `docs/guides/google-social-login.md`, `docs/MOBILE-API.md` — new docs.

## Data flow

1. Mobile app gets an ID token from the native Google Sign-In SDK (configured with the backend's Web OAuth client as `webClientId`, so the token's `aud` claim equals `GOOGLE_CLIENT_ID`).
2. `POST /api/mobile/google-login` decodes (not verifies — just reads) the token's `email` claim locally to check whether a `user` row with that email already exists, **before** calling better-auth. This is only used to decide `isNewUser` for points/notification purposes; it has no security role.
3. `auth.api.signInSocial({ body: { provider: "google", idToken: { token } } })` does the real verification: signature (Google's JWKS), issuer, audience (`GOOGLE_CLIENT_ID`), max age 1h (see `@better-auth/core/social-providers/google.mjs`), then either creates a user (admin plugin's `user.create.before` hook sets `role: "user"` by default) or links/reuses the existing one (`oauth2/link-account.mjs`).
4. Route response mirrors `/api/mobile/login` shape: `{ redirect: false, token, user }`.
5. If `isNewUser`: `creditDefaultRegistrationPointsToUser(userId)` (same one-time bonus as phone registration) + `handleAuthDeviceAndNotifications({ event: "register" })` (welcome push). Otherwise `{ event: "login" }` (login push). Both paths persist the FCM device token if provided.

## Schema impact

None — no migration. Uses the existing `user`/`account`/`session` tables that better-auth already manages.

## Auth & permissions

Public endpoint (no bearer token in) — it *creates* a session/bearer token, like `/api/mobile/login` and `/api/mobile/register`.

## Edge cases & known limitations

- **New-vs-existing detection is a pre-check, not atomic.** The route reads `user` by email, then separately calls `signInSocial`. A pathological double-submit race (two simultaneous first-time sign-ins with the same email) could both see "no existing row" and both credit points — same class of race as any check-then-act pattern in this codebase; not newly introduced, but worth knowing since `creditDefaultRegistrationPointsToUser` is **not idempotent** (unlike the phone/password register route, which only ever calls it once per synchronous request).
- **Undecodable/malformed `idToken`** (can't be split into JWT segments, or isn't valid base64/JSON): the route treats this as "existing user" (skips the bonus) and forwards the raw token to better-auth anyway — better-auth's real verification will reject a malformed token with a 401. The pre-check is advisory only; it never blocks the request.
- **Account linking** relies on Google's `email_verified` claim being trusted; `trustedProviders: ["google"]` makes linking explicit and independent of whether Google happens to report `email_verified: true` for a given token.
- **Role assignment** for new social users is handled entirely by better-auth's built-in `admin()` plugin default (`role: "user"`) — no separate hook was added, since phone registration's explicit `role: "user"` patch exists only to work around a response-timing quirk (see `app/api/mobile/register/route.ts`), not because the default is wrong.
