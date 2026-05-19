# Credit Settings — Combined 5-Tab Form

## What changed

`features/points/components/CreditSettingsForm.tsx` — Extended from 3 tabs (Defaults / Payment Methods / Point Packages) to 5 tabs by adding **Feature Settings** and **Premium Dealers** tabs. Both use the same master/detail split layout as the existing tabs.

`features/points/actions/points.ts` — `saveCreditSettingsAction` now saves feature tiers, home featured limit, and dealer packages in addition to the existing fields (default points, payment methods, point packages). All 5 sections save with a single "Save changes" button.

`features/points/db/points.ts` — Added optional `enabled?: boolean` field to `FeaturePricingTier` and `PremiumDealerPackage` types, with corresponding parser and save updates.

`app/admin/credit/page.tsx` — Fetches `getFeatureSettings()` and `getPremiumDealersSettings()` in parallel with the existing queries and passes them to `CreditSettingsForm`.

## Data flow

```
page.tsx (server)
  └─ Promise.all([getPointManagementSettings, getPointPurchasePackages, getFeatureSettings, getPremiumDealers])
       └─ CreditSettingsForm (client, 5 tabs)
            └─ handleSubmit → saveCreditSettingsAction (server action)
                 ├─ savePointManagementSettings (defaultPts + paymentMethods)
                 ├─ savePointPurchasePackagesSettings (packages)
                 ├─ saveFeatureSettings (featureTiers + homeFeaturedLimit)
                 └─ savePremiumDealersSettings (dealerPackages)
```

## New form fields submitted

| FormData key | Content |
|---|---|
| `featureTiersJson` | `FeaturePricingTier[]` with `enabled` field |
| `homeFeaturedLimit` | integer, 1–100 |
| `dealerPackagesJson` | `PremiumDealerPackage[]` with `enabled` field |

## Feature Settings tab

- Master list: each tier shows duration badge (`{days}d`), label ("7 Days"), points cost
- Detail: Duration select, Points input, Badge label, per-day rate (readonly), Feature product limit stepper
- Feature product limit is a global setting displayed contextually in the detail pane

## Premium Dealers tab

- Master list: each package shows pointsRequired badge (pink), name, durationDays
- Detail: Package name, Points required, Duration (days), per-day rate (readonly)
- Live/Hidden toggle per package (stored as `enabled` field)

## `enabled` field on tiers and packages

`FeaturePricingTier.enabled` and `PremiumDealerPackage.enabled` are now stored in the JSON blobs. Default is `true` (omitted from existing data — parsed as `undefined`, initialised as `true` in form state). The mobile API does not yet filter by this field — that is a separate task.

## Auth & permissions

Same as existing credit settings: requires admin session with `canAdminManageUsers` role check enforced inside `saveCreditSettingsAction`.
