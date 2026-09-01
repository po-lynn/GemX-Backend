# Guide: Premium dealer package upgrade (mobile)

## Prerequisites

- User must be logged in (Bearer token).
- User must have an **active, non-expired** premium dealer subscription.
- Target package must exist in admin **Point Packages → Premium Dealer** settings.

## Mobile flow

1. **GET `/api/mobile/premium-dealers/status`** — confirm `active: true` and note `packageName`.
2. **GET `/api/mobile/premium-dealers/settings`** — list packages with `level`. Show upgrade options where `level` > current package level.
3. Display upgrade cost as `target.pointsRequired − current.pointsRequired` (for UI preview only; server recalculates on submit).
4. **POST `/api/mobile/premium-dealers/upgrade`** with `{ "targetPackageName": "Diamond Package" }`.
5. Refresh status/history on success.

## Example

```bash
curl -X POST "http://localhost:3000/api/mobile/premium-dealers/upgrade" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetPackageName":"Diamond Package"}'
```

## Extending

- **Add a new tier:** append to `premium_dealers_packages_json` in admin; `level` increases automatically.
- **Disable a tier:** set `enabled: false` in admin JSON; it will not appear as an upgrade target.
- **Ledger:** upgrades appear in **GET `/api/mobile/points/history`** as `type: premium_upgrade`.

## Common errors

| HTTP | Message | Fix |
|------|---------|-----|
| 409 | No active premium dealer subscription to upgrade | Activate first via **5.4.3a** |
| 409 | Target package must be a higher tier… | Pick a package with higher `level` |
| 422 | Insufficient points balance | Top up points first |
| 404 | Package not found | Use exact name from settings |
