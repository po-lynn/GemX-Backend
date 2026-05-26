# Premium dealers list — `premiumSinceDate`

## What changed

- `features/points/db/points.ts` — `getActivePremiumDealers()` subquery: `min(start_date)` per user as `premiumSinceDate`.
- `app/api/mobile/premium-dealers/route.ts` — exposes `premiumSinceDate` (ISO string) on each list item.
- `docs/MOBILE-API.md` — section **5.4.3c** and endpoint tables.

## Data flow

`premium_dealers_packages` → correlated `min(start_date)` for `user.id` → route maps to ISO 8601 in JSON.

Active row fields (`packageName`, `startDate`, `expiresAt`, `autoRenew`) still come from the current non-expired active package join.

## Schema impact

None.

## Auth

Public endpoint.

## Edge cases

- **`premiumSinceDate`** vs **`startDate`**: after renewals, `startDate` is the current term; `premiumSinceDate` is the first-ever activation.
- **`firstPremiumDealerYear`** uses earliest `created_at`; **`premiumSinceDate`** uses earliest `start_date` (may differ slightly).
