# Load Testing — Design Spec

**Date:** 2026-07-25
**Status:** Approved for planning

## Goal

Before mobile app store launch, verify GemX's production infrastructure (Vercel + Supabase Postgres) can handle:
- **Mobile API:** 200 concurrent virtual users (mix of non-logged-in browsing and logged-in authenticated actions)
- **Admin panel:** ~5 concurrent staff users comfortably, then find the actual breaking point above that for future headroom planning

Test runs against **production**, off-peak hours, with full read+write actions — including registration, login, favorites, chat, and points purchase requests — using dedicated, clearly-tagged test accounts so real users and real data are never touched.

The production URL is not hardcoded anywhere — every k6 script reads it from a `BASE_URL` environment variable (e.g. `BASE_URL=https://gemx.example.com k6 run tests/load/mobile-non-login.js`), documented in `tests/load/README.md`.

## Tooling

- **k6** (Go binary, JS-scriptable) — industry standard, built-in thresholds/checks, good CLI summary output, free.
- Scripts live in `tests/load/`, sibling to `tests/unit|api|integration|component`. Not part of `npm run test` — load tests are run manually, deliberately, never in CI/pre-commit.

## File layout

```
tests/load/
  mobile-non-login.js         # anonymous browsing scenario
  mobile-authenticated.js      # authenticated actions, using pre-minted tokens (no login call)
  mobile-login-endpoint.js     # small, separate scenario that spot-checks /api/mobile/login itself
  admin-steady.js               # 5 concurrent admin VUs
  admin-ramp.js                  # step ramp to find admin breaking point
  results/                      # JSON summaries per run, timestamped
  .loadtest-ids.json             # manifest of seeded test IDs + pre-minted tokens (git-ignored)
  README.md                     # how to run, how to clean up

scripts/
  seed-load-test-data.ts     # creates tagged test accounts/products, mints tokens, writes manifest
  cleanup-load-test-data.ts  # deletes everything in the manifest
```

## Test data seeding

`scripts/seed-load-test-data.ts` (pattern follows existing `data/seed-admin.ts`) creates accounts **by importing the Better Auth server instance (`lib/auth.ts`) and calling `auth.api.signUpEmail`/`signInEmail` in-process** — not via the HTTP `/api/mobile/register` or `/api/mobile/login` routes. This matters because those routes are rate-limited per-IP (`register`: 5/60min, `login`: 10/15min — see Rate Limiting below); creating 220+ accounts and minting 200 session tokens through the HTTP layer from one machine would trip those limits immediately. Calling the auth library directly bypasses the route-level rate limiter entirely and is the only way to seed at this scale.

- **200 mobile buyer accounts** — phone `099000001`–`099000200`, name `LoadTest Buyer N`. Each account's `token` (from the `signUpEmail`/`signInEmail` result) is captured immediately and stored in the manifest — `mobile-authenticated.js` reuses these tokens directly as `Authorization: Bearer <token>` and never calls `/api/mobile/login` per-VU.
- **20 mobile seller accounts** — phone `099010001`–`099010020`, name `LoadTest Seller N`, each owning 1–2 test products titled with a `[LOADTEST]` prefix (`product.sellerId` = seller's `user.id`, `product.status = "active"`, `product.moderationStatus = "approved"` so they're actually visible/favoritable).
- **20 extra admin test accounts** (`loadtest-admin-N@gemx.test`, `role: "admin"`) for the ramp phase, on top of the 5 real admin logins used in `admin-steady.js`. Admin tokens are minted the same in-process way.
- All created IDs and tokens are written to `tests/load/.loadtest-ids.json`.

`scripts/cleanup-load-test-data.ts` reads that manifest and deletes: accounts (`user`, `session`, `account` rows), products, chat threads/messages (`chat_message` rows referencing test user IDs), purchase requests (`point_purchase_request`), and points ledger entries (`point_transaction`) tied to those IDs. Run immediately after every load test.

## Scenarios

| Script | Simulates | Load profile |
|---|---|---|
| `mobile-non-login.js` | ~70% of mobile VUs: `GET /api/categories?type=`, `GET /api/products?page=&limit=&...filters`, `GET /api/products/[id]`, `GET /api/news?page=&limit=`, `GET /api/articles?page=&limit=` (all public, no auth) | ramp 0→140 VUs over 1m, hold 5m, ramp down |
| `mobile-authenticated.js` | ~30% of mobile VUs, using pre-minted tokens from the manifest (no login call): `GET /api/mobile/favourite-products?page=&limit=`, `POST /api/mobile/favourite-products {productId}` on a `[LOADTEST]` product, `POST /api/chat/messages {recipientId, content}` to another LoadTest account only, occasional `POST /api/mobile/points/purchase-requests {package_name, payment_method, currency, transferredAmount, transferredName, transactionReference, transferNote}` | ramp 0→60 VUs over 1m, hold 5m, ramp down |
| `mobile-login-endpoint.js` | Spot-checks `POST /api/mobile/login {phone, password}` latency only — capped at 8 requests per 15-minute window (under the 10/15min limit), not a concurrency test | 8 iterations, spaced ~2min apart |
| `admin-steady.js` | 5 real admin sessions, authenticated via `POST /api/auth/sign-in/email {email, password}` (cookie jar or captured `token` as bearer — no separate admin login route, and this endpoint is **not** rate-limited): list views (`GET /api/admin/point-purchase-requests?status=&page=&limit=`, products, users), open an edit form, `POST /api/admin/point-purchase-requests/[id]/approve {adminNote}` on a `[LOADTEST]`-tagged request | flat 5 VUs, hold 5m |
| `admin-ramp.js` | Same admin actions, using the 20 extra test admin accounts plus the 5 real ones | step 5→10→20→50→100 VUs, 2m per step, stop at first threshold breach |

## Guardrails (hard rules, not suggestions)

1. **Chat writes stay within test accounts.** The script only pulls recipient IDs from the seed manifest — a LoadTest buyer only ever messages a LoadTest seller. No real user ever receives a load-test-triggered push notification.
2. **Every write is tagged and tracked.** Products use a `[LOADTEST]` title prefix; all created row IDs go into the manifest so cleanup is exact, not a fuzzy `WHERE name LIKE`.
3. **Smoke test first.** Before any full ramp, run each scenario at 1 VU / 1 iteration to catch a broken script before it fires against prod at scale.
4. **Live-watched, killable.** The operator watches k6's live console output for the whole run; Ctrl+C stops new iterations immediately if anything looks wrong.
5. **Mandatory cleanup + spot-check.** Run `cleanup-load-test-data.ts` immediately after every test, then manually check the admin purchase-requests and chat dashboards to confirm no `[LOADTEST]` rows remain visible to staff.

## Rate limiting (verified, `lib/rate-limit.ts`)

Fixed-window, in-memory, keyed per-IP — since k6 runs from one machine (one IP), any endpoint below must stay under its cap across the *whole* run, not per-VU:

| Endpoint | Limit |
|---|---|
| `POST /api/mobile/login` | 10 / 15 min |
| `POST /api/mobile/register` | 5 / 60 min |
| `POST /api/push/global/subscribe` (and `unsubscribe`) | 20 / 60 sec |
| `POST /api/auth/sign-in/email` (admin login) | **not** rate-limited |
| Any `/api/admin/*` route | **not** rate-limited |

This is why all mobile test accounts are created and authenticated in-process during seeding (see above) rather than through the HTTP register/login routes, and why `mobile-login-endpoint.js` is a small separate spot-check rather than part of the main authenticated scenario.

## Auth mechanics (verified)

- Register/login success responses carry the session token as a **top-level `token` field** (`{ token, user }`), not nested under `session` — confirmed against Better Auth's actual response shape, not just the docs.
- Subsequent requests authenticate via `Authorization: Bearer <token>`. The Better Auth `bearer()` plugin converts this into an internal session cookie before each route's own `auth.api.getSession({ headers })` check runs — every route (mobile and admin) checks the same way, no separate custom auth helper.
- Admin has no dedicated login route — `POST /api/auth/sign-in/email {email, password}` is the same Better Auth endpoint the web admin login form uses. k6 can either use a cookie jar (`http.cookieJar()`) to replay the `Set-Cookie`, or capture the response's `token` and send it as a bearer header on subsequent admin API calls — either works per `lib/api-guard.ts`.

## Thresholds (pass/fail criteria)

Tagged by endpoint type in k6:

```
http_req_duration{endpoint_type:read}:  p(95) < 800ms
http_req_duration{endpoint_type:write}: p(95) < 1500ms
http_req_failed: rate < 1%
```

Applied independently to:
- Mobile steady state (200 VUs combined)
- Admin steady state (5 VUs)
- Admin ramp (reports the VU count at which the first threshold breaks — this is the effective headroom number)

## Reporting

k6's end-of-run summary (req/s, p95/p99 latency, error rate per scenario) prints to console and saves as JSON to `tests/load/results/<timestamp>.json`, so future re-runs (e.g. after a fix or before the next launch milestone) can be diffed against a baseline.

## Out of scope

- No CI integration (manual, deliberate runs only, given production target)
- No SMS/email side-effect concerns — confirmed no OTP/SMS or email provider exists in the codebase (`docs/technical/load-testing.md` will note this finding)
- No changes to any `app/api/` route — this only exercises existing endpoints, so no `docs/api/` doc is required per the post-change checklist

## Deliverables

- `docs/technical/load-testing.md` — what was built, data flow, thresholds-to-endpoints mapping
- `docs/guides/load-testing.md` — how to run a load test end-to-end, how to add a new scenario
- `tests/load/README.md` — quick-reference run/cleanup commands
