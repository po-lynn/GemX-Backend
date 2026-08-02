# Deep link verification endpoints

Not under `app/api/` (they're platform-mandated paths under
`/.well-known/`), but they are new route handlers, documented here for
completeness. Both are public, unauthenticated, GET-only.

## `GET /.well-known/apple-app-site-association`

**Auth:** public.

**Request:** no params.

**Response:** `200`, `Content-Type: application/json`, no redirect (required
by iOS — a route handler guarantees this, unlike a static file which would
need an extension).

```json
{
  "applinks": {
    "apps": [],
    "details": [
      { "appID": "TEAMID.com.kyawminkhant.GemX", "paths": ["/products/*"] }
    ]
  }
}
```

`appID` is `${APPLE_TEAM_ID}.com.kyawminkhant.GemX` — see
`lib/deep-link.ts`. If `APPLE_TEAM_ID` is unset, `appID` will be malformed
(`.com.kyawminkhant.GemX`) and iOS verification fails safely (falls back to
opening the browser) rather than the route erroring.

**Example:**

```bash
curl -i https://gemxpremium.com/.well-known/apple-app-site-association
```

**Mobile flag:** consumed by the OS, not by app code — iOS fetches and
caches this at install time.

## `GET /.well-known/assetlinks.json`

**Auth:** public.

**Request:** no params.

**Response:** `200`, JSON array.

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.kyawminkhant.GemX",
      "sha256_cert_fingerprints": ["AA:BB:CC:...:ZZ"]
    }
  }
]
```

`sha256_cert_fingerprints` comes from `ANDROID_SHA256_CERT_FINGERPRINTS`
(comma-separated env var, split/trimmed in `lib/deep-link.ts`). Empty/unset
→ empty array → verification fails safely.

**Example:**

```bash
curl -s https://gemxpremium.com/.well-known/assetlinks.json | jq
```

**Mobile flag:** consumed by the OS via `adb shell pm verify-app-links`, not
by app code.
