# Social login (mobile)

## Prerequisites

- Backend env vars set (`.env.local`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — from a **Web application** OAuth client in Google Cloud Console (Project: `gemx`).
- Mobile app (RN) has its own separate Android/iOS OAuth clients in the same Google Cloud project, each configured with the backend's Web client ID as `webClientId` (for `@react-native-google-signin/google-signin`) so the ID token it produces has the right audience.

## Backend usage

No web-facing UI change — this is a single endpoint the mobile app calls directly.

```bash
curl -X POST http://localhost:3000/api/mobile/social-login \
  -H "Content-Type: application/json" \
  -d '{"provider":"google","idToken":"<google-id-token>","fcmToken":"fcm-abc","platform":"android"}'
```

Response and error shapes: see `docs/api/mobile-social-login.md`. Store `token` from the response and send it as `Authorization: Bearer <token>` exactly like `/api/mobile/login`.

## Non-Myanmar signup — filling profile fields in the same call

Myanmar users register with phone + password (`POST /api/mobile/register`, unchanged). Non-Myanmar users don't have a Myanmar-format phone number, so instead of a phone/password screen, show a "Continue with Google" button and send the same Screen-1 fields (name, country, state, city, address, gender, dateOfBirth, an ID string, optional KYC upload URLs) alongside the idToken:

```ts
const res = await fetch(`${API_BASE}/api/mobile/social-login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    provider: "google",
    idToken,
    platform: Platform.OS,
    name: "Jane Doe",
    country: "Others",
    state: "Bangkok",
    city: "Bangkok",
    address: "123 Main St",
    gender: "female",
    dateOfBirth: "1990-01-15",
    nrc: "PASSPORT123", // plain passport/national ID — no Myanmar-format check when country isn't Myanmar
  }),
});
```

These fields are only written when the call creates a **brand-new** user (response status 201). If the same person signs in again later (200), sending these fields again does nothing — edit an existing profile via `PATCH /api/mobile/profile` instead.

## React Native integration sketch

```ts
import { GoogleSignin } from "@react-native-google-signin/google-signin";

GoogleSignin.configure({ webClientId: "<GOOGLE_CLIENT_ID from backend>" });

async function signInWithGoogle(profileFields: Record<string, unknown>) {
  await GoogleSignin.hasPlayServices();
  const { idToken } = await GoogleSignin.signIn();
  const res = await fetch(`${API_BASE}/api/mobile/social-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "google", idToken, platform: Platform.OS, ...profileFields }),
  });
  const { token, user } = await res.json();
  await SecureStore.setItemAsync("session_token", token);
}
```

## Extending — adding Facebook next

Facebook is not wired yet — `isSupportedProvider` in `app/api/mobile/social-login/route.ts` only allows `"google"`, so a `provider: "facebook"` request returns 400 today. To add it:
1. Add `facebook: { clientId, clientSecret }` to `socialProviders` in `lib/auth.ts`, add `"facebook"` to `account.accountLinking.trustedProviders`.
2. Add `"facebook"` to the `SUPPORTED_PROVIDERS` list in `app/api/mobile/social-login/route.ts` — Facebook's native SDK returns an `accessToken`, not an `idToken`, so the request body and the `signInSocial` call differ slightly (`idToken: { token, accessToken }` per better-auth's Facebook provider — check `getUserInfo` requirements before wiring the client, since Facebook needs a `Graph API` call rather than a self-contained JWT).
3. Extend `tests/api/mobile/social-login.test.ts` and `docs/api/mobile-social-login.md` for the new provider.

## Common errors

- **401 "Social sign-in failed"** — most likely the ID token's audience doesn't match `GOOGLE_CLIENT_ID` (mobile app is using an Android/iOS client ID as `webClientId` instead of the Web client ID), or the token is expired (Google ID tokens are short-lived; don't cache and reuse them).
- **400 "Unsupported provider..."** — the client sent a `provider` other than `"google"` (e.g. `"facebook"` before it's wired up).
- **400 "Invalid NRC format..."** — `nrc` was sent while `country` is Myanmar (or omitted) but doesn't match the Myanmar NRC format. Either fix the NRC string or make sure `country` is set to something other than Myanmar so it's treated as a plain ID.
- **User created with missing profile fields** — if the client didn't send the optional profile fields, they stay `null` on the new user, same as any account. They can be filled in later via `PATCH /api/mobile/profile`, but only if they weren't sent at signup — sending them at signup avoids the extra round trip.
