# GET /api/mobile/premium-dealers

## Endpoint

`GET /api/mobile/premium-dealers`

## Auth

None (public).

## Response

**200** — `{ "premiumDealers": [ ... ] }`

Each item includes **`premiumSinceDate`** (ISO 8601): earliest `premium_dealers_packages.start_date` for that user. **`startDate`** is only the current active package start.

See `docs/MOBILE-API.md` section **5.4.3c** for the full field list.

## Mobile

Yes.
