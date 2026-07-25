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
  lib/auth.js              # shared login helper, returns bearer token per VU
  mobile-non-login.js       # anonymous browsing scenario
  mobile-login.js           # authenticated scenario
  admin-steady.js           # 5 concurrent admin VUs
  admin-ramp.js              # step ramp to find admin breaking point
  results/                  # JSON summaries per run, timestamped
  .loadtest-ids.json        # manifest of seeded test IDs (git-ignored)
  README.md                 # how to run, how to clean up

scripts/
  seed-load-test-data.ts     # creates tagged test accounts/products, writes manifest
  cleanup-load-test-data.ts  # deletes everything in the manifest
```

## Test data seeding

`scripts/seed-load-test-data.ts` (pattern follows existing `data/seed-admin.ts`):

- **200 mobile buyer accounts** — phone `099000001`–`099000200`, name `LoadTest Buyer N`
- **20 mobile seller accounts** — phone `099010001`–`099010020`, name `LoadTest Seller N`, each owning 1–2 test products titled with a `[LOADTEST]` prefix
- **20 extra admin test accounts** (`loadtest-admin-N@gemx.test`) for the ramp phase, on top of the 5 real admin logins used in `admin-steady.js`
- All created IDs (user IDs, product IDs) are written to `tests/load/.loadtest-ids.json`

`scripts/cleanup-load-test-data.ts` reads that manifest and deletes: accounts, products, chat threads/messages, purchase requests, and points ledger entries tied to those IDs. Run immediately after every load test.

## Scenarios

| Script | Simulates | Load profile |
|---|---|---|
| `mobile-non-login.js` | ~70% of mobile VUs: browse categories → search products → view product detail → view news/articles (public GETs, no auth) | ramp 0→140 VUs over 1m, hold 5m, ramp down |
| `mobile-login.js` | ~30% of mobile VUs: login → view profile/points balance/favorites/notifications → favorite a `[LOADTEST]` product → send a chat message to another LoadTest seller account → occasionally create a points purchase-request | ramp 0→60 VUs over 1m, hold 5m, ramp down |
| `admin-steady.js` | 5 real admin sessions: list views (products/users/purchase-requests), open an edit form, approve a `[LOADTEST]`-tagged purchase request | flat 5 VUs, hold 5m |
| `admin-ramp.js` | Same admin actions, using the 20 extra test admin accounts plus the 5 real ones | step 5→10→20→50→100 VUs, 2m per step, stop at first threshold breach |

## Guardrails (hard rules, not suggestions)

1. **Chat writes stay within test accounts.** The script only pulls recipient IDs from the seed manifest — a LoadTest buyer only ever messages a LoadTest seller. No real user ever receives a load-test-triggered push notification.
2. **Every write is tagged and tracked.** Products use a `[LOADTEST]` title prefix; all created row IDs go into the manifest so cleanup is exact, not a fuzzy `WHERE name LIKE`.
3. **Smoke test first.** Before any full ramp, run each scenario at 1 VU / 1 iteration to catch a broken script before it fires against prod at scale.
4. **Live-watched, killable.** The operator watches k6's live console output for the whole run; Ctrl+C stops new iterations immediately if anything looks wrong.
5. **Mandatory cleanup + spot-check.** Run `cleanup-load-test-data.ts` immediately after every test, then manually check the admin purchase-requests and chat dashboards to confirm no `[LOADTEST]` rows remain visible to staff.

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
