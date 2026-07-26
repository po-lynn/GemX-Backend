# Google social login (mobile)

## Prerequisites

- Backend env vars set (`.env.local`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — from a **Web application** OAuth client in Google Cloud Console (Project: `gemx`).
- Mobile app (RN) has its own separate Android/iOS OAuth clients in the same Google Cloud project, each configured with the backend's Web client ID as `webClientId` (for `@react-native-google-signin/google-signin`) so the ID token it produces has the right audience.

## Backend usage

No web-facing UI change — this is a single endpoint the mobile app calls directly.

```bash
curl -X POST http://localhost:3000/api/mobile/google-login \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<google-id-token>","fcmToken":"fcm-abc","platform":"android"}'
```

Response and error shapes: see `docs/api/mobile-google-login.md`. Store `token` from the response and send it as `Authorization: Bearer <token>` exactly like `/api/mobile/login`.

## React Native integration sketch

```ts
import { GoogleSignin } from "@react-native-google-signin/google-signin";

GoogleSignin.configure({ webClientId: "<GOOGLE_CLIENT_ID from backend>" });

async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices();
  const { idToken } = await GoogleSignin.signIn();
  const res = await fetch(`${API_BASE}/api/mobile/google-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, platform: Platform.OS }),
  });
  const { token, user } = await res.json();
  await SecureStore.setItemAsync("session_token", token);
}
```

## Extending — adding Facebook next

Follow the same pattern:
1. Add `facebook: { clientId, clientSecret }` to `socialProviders` in `lib/auth.ts`, add `"facebook"` to `account.accountLinking.trustedProviders`.
2. New route `app/api/mobile/facebook-login/route.ts`, near-identical to `google-login/route.ts` — Facebook's native SDK returns an `accessToken`, not an `idToken`, so the request body and the `signInSocial` call differ slightly (`idToken: { token, accessToken }` per better-auth's Facebook provider — check `getUserInfo` requirements before wiring the client, since Facebook needs a `Graph API` call rather than a self-contained JWT).
3. Mirror the same tests/docs.

## Common errors

- **401 "Google sign-in failed"** — most likely the ID token's audience doesn't match `GOOGLE_CLIENT_ID` (mobile app is using an Android/iOS client ID as `webClientId` instead of the Web client ID), or the token is expired (Google ID tokens are short-lived; don't cache and reuse them).
- **User created with wrong/missing profile fields** — Google's ID token only carries `email`, `name`, `picture`; NRC/phone/address remain `null` until the user fills the profile screen (`POST /api/profile`), same as any account.
