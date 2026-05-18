# Point Packages Admin — UI Redesign

## What changed

Replaced the stacked-card form at `/admin/credit` with a tabbed workspace layout: a 264px left rail with three tab buttons and a right pane that renders per-tab content.

**Files touched:**
- `app/admin/credit/page.tsx` — removed duplicate header, widened to `max-w-5xl`
- `features/points/components/CreditSettingsForm.tsx` — full rewrite
- `features/points/db/points.ts` — added optional fields to `PaymentMethod` and `PointPurchasePackage`
- `features/points/actions/points.ts` — updated `saveCreditSettingsAction` mappers to pass new fields through

## Layout

```
┌────────────────────────────────────────────────────────┐
│  Page header (title + Save button)                     │
├──────────────┬─────────────────────────────────────────┤
│  Left rail   │  Right pane                             │
│  (264px)     │                                         │
│              │  Defaults tab: single points field      │
│  ● Defaults  │  Methods tab: 240px list + detail form  │
│  ● Methods   │  Packages tab: 240px list + detail form │
│  ● Packages  │                                         │
│              │                                         │
│  [Help box]  │                                         │
└──────────────┴─────────────────────────────────────────┘
```

## New data fields

### `PaymentMethod` (in `db/points.ts`)
| Field | Type | Description |
|-------|------|-------------|
| `type` | `'kbz' \| 'aya' \| 'wave' \| 'cb' \| 'other'` | Drives the colored gradient icon in the list |
| `enabled` | `boolean` | Controls visibility in the mobile app |

Both are optional for backward compatibility — existing saved methods without these fields default to `type: 'other'` and `enabled: true` in the UI.

### `PointPurchasePackage` (in `db/points.ts`)
| Field | Type | Description |
|-------|------|-------------|
| `bonus` | `number` | Extra free points on top of base (displayed as `+N bonus` chip) |
| `popular` | `boolean` | Marks this tier with a badge in the app; only one allowed at a time |
| `enabled` | `boolean` | Controls visibility in the mobile app |

All optional. Per-point rate (read-only) is calculated as `priceMmk / (points + bonus)`.

## Data flow

1. Page (`app/admin/credit/page.tsx`) calls `getPointManagementSettings()` and `getPointPurchasePackagesSettings()` server-side
2. Props flow into `CreditSettingsForm` (client component)
3. State initialized from props; each tab manages its own slice (`methods`, `packages`, `defaultPts`)
4. On save, `saveCreditSettingsAction(formData)` is called with `paymentMethodsJson` and `packagesJson` (new fields included)
5. Action parsers in `actions/points.ts` forward `type`, `enabled`, `bonus`, `popular` to the DB layer
6. DB layer (`parsePaymentMethodsJson`, `parsePointPurchasePackagesJson`) reads them back

## Auth & permissions

Same as before — `canAdminManageUsers(session.user.role)` in the action. Session auth via cookie.

## Edge cases

- Removing all packages/methods leaves an empty list; adding creates a new item and auto-selects it
- "Popular" is exclusive: toggling one package popular clears popular on all others
- `bonus = 0` is not stored in JSON (omitted); defaults to 0 on load
- The `_id` field is transient (React key + selection tracking), stripped before serialization
