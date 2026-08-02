# Product share deep linking — collaborator guide

Lets a product share link (`https://gemxpremium.com/products/:id`, generated
on the mobile side by `productShareUrl()`) open the GemX app directly if
installed, or a real product page in the browser otherwise. See the mobile
repo's deep-linking handoff doc for the full picture — this guide covers only
the website half, implemented here.

## Prerequisites

Three env vars (`.env.example`), all obtained from whoever manages the
Apple/Google developer accounts, via `eas credentials` in the **mobile** repo:

```
APPLE_TEAM_ID=                     # Apple Developer > Membership, or `eas credentials -p ios`
ANDROID_SHA256_CERT_FINGERPRINTS=  # `eas credentials -p android` > production build credentials
IOS_APP_STORE_URL=                 # e.g. https://apps.apple.com/app/id1234567890, once listed
```

⚠️ Use the **production** Android signing cert, not
`android/app/debug.keystore` from the mobile repo — that's debug-only and
won't match production installs. `ANDROID_SHA256_CERT_FINGERPRINTS` accepts
a comma-separated list if you ever need to trust more than one cert (e.g.
debug + production during testing).

## How it works end-to-end

1. Someone shares a product from the app → they get
   `https://gemxpremium.com/products/123`.
2. Tapping it: iOS checks the cached
   `/.well-known/apple-app-site-association`, Android checks
   `/.well-known/assetlinks.json`. Match → app opens directly to
   `/home/product?id=123` (handled entirely on the mobile side, already
   done). No match / app not installed → browser opens
   `app/products/[id]/page.tsx`.
3. The browser page shows the product (image, price, seller) with working
   Open Graph tags for link previews in WhatsApp/iMessage/etc., plus
   "Open in GemX app" / App Store / Play Store links.

## Extending it

**Add a field to the share page** (e.g. show carat weight): edit
`app/products/[id]/page.tsx` — it already has the full `ProductForEdit`
object from `getCachedProduct(id)`, same shape used by
`GET /api/products/[id]`.

**Add a second shareable entity** (e.g. articles already have this pattern —
see `app/articles/[id]/page.tsx`): don't touch the `.well-known` routes for a
new path unless it needs a different app path — `paths: ["/products/*"]` in
`apple-app-site-association/route.ts` only covers `/products/*`. Add another
entry to the `details` array for a new top-level path.

**Rotate the Android signing cert**: update
`ANDROID_SHA256_CERT_FINGERPRINTS` in Vercel's env vars (comma-separate old +
new during the transition so already-installed devices don't lose
verification), then `adb shell pm verify-app-links --re-verify
com.kyawminkhant.GemX` on a test device to force Android to re-check.

## Common errors

- **Link opens the browser even with the app installed** — most likely the
  AASA/assetlinks files aren't returning the values Apple/Google expect.
  Check `APPLE_TEAM_ID`/`ANDROID_SHA256_CERT_FINGERPRINTS` are actually set
  in the deployed environment (not just `.env.local`), then re-verify: iOS
  only fetches AASA at **install time** (reinstall to pick up changes),
  Android via `adb shell pm verify-app-links --re-verify
  com.kyawminkhant.GemX`.
- **`/products/:id` 404s** — the product's `status` is `"draft"`, or the id
  doesn't exist. Check `getCachedProduct(id)` directly.
- **Link preview card is blank/wrong** — `generateMetadata` in
  `app/products/[id]/page.tsx` omits `description`/`images` for collector
  pieces by design (see technical doc) — that's not a bug.
- **Don't** re-add a custom URL scheme (`gemx://...`) to the *shared* URL
  itself — chat apps only auto-linkify `http(s)://` text. The scheme is only
  used internally by `OpenInAppRedirect`'s same-page JS redirect.

## Full testing checklist

See the mobile repo's deep-linking doc for the complete iOS/Android device
checklist (fresh install + `xcrun simctl openurl`, `adb shell pm
get-app-links`, uninstall-then-tap fallback, etc.) — those steps are
identical for verifying this side once the env vars above are filled in and
deployed.
