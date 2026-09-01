# Premium dealer package upgrade

## What changed

Mobile users with an **active** premium dealer subscription can upgrade to a **higher** tier by paying only the **points difference** between packages. Pricing, tier order, and validation are computed server-side from `premium_dealers_packages_json`.

### Files

| Path | Role |
|------|------|
| `features/points/db/points.ts` | `upgradePremiumDealerPackage`, level helpers |
| `app/api/mobile/premium-dealers/upgrade/route.ts` | Mobile upgrade endpoint |
| `app/api/mobile/premium-dealers/settings/route.ts` | Adds `level` to package list |
| `drizzle/schema/points-schema.ts` | Documents `premium_upgrade` ledger type |

## Data flow

```
POST /api/mobile/premium-dealers/upgrade { targetPackageName }
  → auth session
  → upgradePremiumDealerPackage(userId, targetPackageName)
      load active premium_dealers_packages row
      load packages from point_setting
      validate target.level > current.level
      upgradeCost = target.pointsRequired - current.pointsRequired
      transaction:
        deduct upgradeCost from user.points
        old row → status cancelled
        insert new active row (same dates + autoRenew)
        user.premiumDealerPackageName → target
        point_transaction type premium_upgrade
```

## Tier levels

Package **level** is 1-based index in the admin-configured JSON array (first package = level 1). No separate DB column.

## Auth

- Upgrade route: Bearer session (mobile)

## Edge cases

- No active subscription → 409
- Current package removed/disabled in admin → 409
- Target not found/disabled → 404
- Target same or lower level → 409
- Insufficient points → 422 (no partial deduction)
- Upgrade preserves `startDate`, `endDate`, and `autoRenew` from the current period
- Auto-renew cron charges the **new** package's full `pointsRequired` on next renewal
