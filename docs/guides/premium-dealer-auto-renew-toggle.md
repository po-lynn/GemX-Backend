# Collaborator Guide: Premium Dealer Auto-Renew Toggle

## What this feature does

Lets a mobile user who's already a premium dealer turn auto-renew on/off after the fact, via `PATCH /api/mobile/premium-dealers/auto-renew`. Previously this could only be set once, at activation.

## Prerequisites

- Standard dev env (`.env.local`, PostgreSQL, `npm run dev`)
- A user with an active, non-expired premium dealer subscription (activate one via `POST /api/mobile/premium-dealers/activate`)
- No new env vars or dependencies

## End-to-end usage

```bash
# 1. Activate premium (if not already active)
curl -X POST http://localhost:3000/api/mobile/premium-dealers/activate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"packageName":"Basic Package","autoRenew":true}'

# 2. Turn auto-renew off
curl -X PATCH http://localhost:3000/api/mobile/premium-dealers/auto-renew \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"autoRenew":false}'
# => { "success": true, "autoRenew": false }

# 3. Confirm it persisted
curl http://localhost:3000/api/mobile/premium-dealers/status -H "Authorization: Bearer $TOKEN"
# => { ..., "autoRenew": false }
```

On the mobile app, wire the existing "Turn off"/"Turn on" auto-renew pill (shown when `GET /status` returns `active: true`) to call this endpoint instead of only flipping local state, then refresh from `GET /status` (or optimistically set the pill from the response) to confirm.

## Extending it

### Toggling something else on the active subscription

`setPremiumDealerAutoRenew` in `features/points/db/points.ts` selects the current active row (`status = 'active'`, `end_date > now()`, newest `created_at`) then updates it. To toggle another column, add a parameter and include it in the `.set({...})` call — reuse the same row-selection query rather than writing a new one, so it stays consistent with what `GET /status` and the public list treat as "current".

### Adding a new mobile premium-dealer field

1. Add the column to `premiumDealersPackage` in `drizzle/schema/points-schema.ts`, run `npm run db:generate` + `npm run db:migrate`.
2. Extend the relevant query in `features/points/db/points.ts` (`activatePremiumDealer`, `getMyPremiumStatus`, `getActivePremiumDealers`, or a new one).
3. Return it from the route and document it in `docs/MOBILE-API.md`.

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `400 "No active premium dealer subscription"` | User's subscription expired, or was never activated | Only show the toggle when `GET /status` returns `active: true`; re-check status if the call fails |
| `400 "Invalid input"` | `autoRenew` missing or not a boolean (e.g. sent as a string) | Send a JSON boolean: `{"autoRenew": false}`, not `{"autoRenew": "false"}` |
| `401 Unauthorized` | Missing/expired bearer token | Re-authenticate and retry with a fresh session token |
| Toggle doesn't reflect after app restart | Client only updated local UI state, didn't call the endpoint | Confirm the pill's tap handler calls `PATCH /api/mobile/premium-dealers/auto-renew` and re-fetches `GET /status` |
