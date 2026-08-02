# Product share deep linking (website side)

## What changed

Implements the `gemxpremium.com` half of the mobile app's product-sharing deep
link, spec'd in the mobile repo's `message.txt` handoff. The mobile side
(`productShareUrl()`, `app.json` associated domains, `+native-intent.ts`) was
already done; nothing there needed to change. Three pieces were added here:

- `lib/deep-link.ts` — shared constants (bundle/package IDs, env-driven Team
  ID and cert fingerprints, store URLs, custom-scheme URL builder).
- `app/.well-known/apple-app-site-association/route.ts` — iOS Universal
  Links verification file.
- `app/.well-known/assetlinks.json/route.ts` — Android App Links verification
  file.
- `app/products/[id]/page.tsx` + `app/products/[id]/OpenInAppRedirect.tsx` —
  the browser fallback page, with Open Graph metadata for link-preview cards
  and a same-page attempt to hand off to the installed app.
- `.env.example` — new `APPLE_TEAM_ID`, `ANDROID_SHA256_CERT_FINGERPRINTS`,
  `IOS_APP_STORE_URL` vars.

## Data flow

1. OS (iOS/Android) fetches `/.well-known/apple-app-site-association` or
   `/.well-known/assetlinks.json` at install time (iOS) or on demand
   (Android) to decide whether a tapped `https://gemxpremium.com/products/:id`
   link should open the app or the browser. This is a platform-level check —
   nothing in `app/products/[id]/page.tsx` runs before it.
2. If the OS opens the browser (app not installed, or verification failed):
   `app/products/[id]/page.tsx` calls `getCachedProduct(id)` directly — the
   same cached DB read `GET /api/products/[id]` uses — rather than
   self-fetching its own API route, avoiding an unnecessary internal HTTP
   round-trip from a server component.
3. `OpenInAppRedirect` (client component) fires once on mount and sets
   `window.location.href` to the `gemx://products/:id` custom scheme, in case
   the app is installed but verification hasn't propagated yet. This is safe
   here specifically because it's a same-page programmatic redirect, not a
   shared link string — the mobile side deliberately avoided the custom
   scheme for share URLs because chat apps don't linkify `gemx://` text.

## Schema impact

None. No Drizzle schema changes; reuses the existing `product` table via
`getCachedProduct` / `getProductById`.

## Auth & permissions

`app/products/[id]/page.tsx` is fully public — no session, no bearer token.
This has one consequence: `getCachedProduct` returns the same row regardless
of caller, so the page must not assume any of the auth-gated logic that
`GET /api/products/[id]` applies for signed-in users (e.g. the approved
collector-piece show-request check, which needs a session this page never
has). The page always treats a collector piece as "not approved" —
masked price (`maskPrice`), no description — since an anonymous share-link
visitor can never hold that approval. It also never renders seller
phone/username, unlike the authenticated API response, since this page has
no way to know who's viewing it.

The two `.well-known` routes are public, unauthenticated GETs by design —
that's what the OS platform check requires.

## Edge cases & known limitations

- `status === "draft"` → `notFound()`. `archive`/`sold` still render (a sold
  listing is still a valid thing to have shared and view after the fact).
- `APPLE_TEAM_ID` / `ANDROID_SHA256_CERT_FINGERPRINTS` / `IOS_APP_STORE_URL`
  are unset by default — the AASA route will produce a bad (but
  well-formed) `appID`, and `assetlinks.json` will return an empty
  fingerprint list. Both fail verification safely (OS just falls back to the
  browser) rather than crashing. These must be filled in via `eas
  credentials -p ios` / `-p android` before this works end-to-end — see
  `docs/guides/product-deep-linking.md`.
- The Play Store URL is derived from `ANDROID_PACKAGE_NAME` (a fixed
  constant, not a secret); only the iOS App Store URL needs an env var,
  since it embeds an opaque numeric app ID with no fixed relationship to the
  bundle ID.
- The spec's "hide store badges until ~1s after redirect attempt" nicety was
  simplified to "always show store badges, attempt the redirect in the
  background" — avoids a client/server hydration mismatch for one line of
  polish with no functional difference (the OS-level check is what actually
  decides app-vs-browser; this same-page attempt only helps a narrow
  stale-verification window).
