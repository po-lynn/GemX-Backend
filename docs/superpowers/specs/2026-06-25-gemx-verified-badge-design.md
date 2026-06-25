# GemX Verified Badge — Design Spec

**Date:** 2026-06-25  
**Status:** Approved  

## Context

GemX is a gemstone & jewellery marketplace where GemX staff sit between buyers and sellers — deals close via chat or phone. Products go through a moderation workflow (pending → approved → active) but moderation only confirms listing content is acceptable. It does not confirm the physical item has been authenticated.

"GemX Verified" is a separate trust signal meaning a GemX staff member has physically inspected and authenticated the product — its specs (origin, treatment, weight, certification) match reality. This is especially valuable for high-value collector pieces where buyers need confidence before initiating contact.

## Approach

**Option A — boolean flag on the products table.** Same pattern as `isCollectorPiece`, `isFeatured`, `isPrivilegeAssist`. Simple, queryable, fits existing conventions. Full audit trail via the existing `productAdminChangeLog` table.

## Data Model

### New columns on `products` table

```sql
is_verified   boolean   NOT NULL DEFAULT false
verified_at   timestamp (nullable)
verified_by   text      REFERENCES user(id) ON DELETE SET NULL (nullable)
```

- `verified_at` is set to `now()` when toggled on; cleared to `null` when toggled off.
- `verified_by` is set to the acting admin's user id when toggled on; cleared to `null` when toggled off.

### productAdminChangeTypeEnum

Add `"verified"` to the existing enum. Change log entries record:

| Field | Value |
|---|---|
| `changeType` | `"verified"` |
| `oldValue` | `"false"` or `"true"` |
| `newValue` | `"true"` or `"false"` |
| `changedBy` | admin user id |
| `changedAt` | timestamp |

## Business Rules

1. **Tied to approved:** `isVerified` can only be set to `true` when `moderationStatus = 'approved'`. The server action rejects verification attempts on non-approved products. The form also disables the toggle client-side when this condition is not met.
2. **Unverify on moderation change:** if `moderationStatus` is changed away from `approved` (to `pending` or `rejected`), `isVerified` is automatically cleared to `false` and a change log entry is written.
3. **Normal users cannot verify:** the `products.verify` permission controls access. It is never granted to seller/buyer (normal) users.

## RBAC Permission

New permission key: `"products.verify"`

- Configurable per staff member in the existing permissions UI.
- The verified toggle is **hidden entirely** (not just disabled) in the product form if the current user lacks this permission.
- Both admin and supervisor roles can have this permission assigned — it is not locked to any specific role, making it configurable as requested.

## Admin Product Form

**Placement:** Visibility section — alongside Featured, Collector Piece, Privilege Assist, Promotion toggles.

**Toggle row:**
```
[ checkbox ]  GemX Verified
              Mark this product as physically authenticated by GemX staff.
              Only available when moderation status is Approved.
```

**States:**
- Hidden if user lacks `products.verify` permission.
- Disabled with tooltip "Set moderation to Approved first" when `moderationStatus !== 'approved'`.
- Active and toggleable when `moderationStatus === 'approved'` and user has permission.

**Verified-by line (read-only, shown when `isVerified = true`):**
```
Verified by [staff name] on [date]
```
Displayed below the toggle so admins can see provenance without opening the change log.

## Admin Product List View (`ProductsListView`)

A "Verified" pill added to the existing flags row (Featured, Collector, Privilege, Promo). Only rendered when `isVerified = true`. Uses a distinct teal/green color to differentiate from the blue moderation "approved" badge.

## Mobile API

`isVerified: boolean` added to the product response shape for:
- Product list endpoint
- Product detail endpoint

The mobile app uses this field to display the badge in its own UI. No other mobile API changes required.

## Web Homepage (`OwnProductsSection`)

A small "GemX Verified" badge on the product card when `isVerified = true`. Follows the existing "Own Pick" badge pattern already present in that component.

## Surface Area Summary

| Layer | Change |
|---|---|
| `drizzle/schema/product-schema.ts` | 3 new columns + `"verified"` added to change type enum |
| DB migration | Generated via `db:generate`, applied manually |
| `features/products/db/products.ts` | Include new fields in queries; `verifyProduct` / `unverifyProduct` mutation helpers |
| Server action | `verifyProductAction` — validates permission + moderationStatus, writes fields + change log |
| Existing moderation update action | When `moderationStatus` changes away from `approved`, auto-clear `isVerified` and write a `"verified"` change log entry |
| `features/products/components/ProductForm.tsx` | Verified toggle in Visibility section; read-only verified-by line; RBAC guard |
| `features/products/components/ProductsListView.tsx` | Verified pill in flags row |
| Mobile API product endpoints | Add `isVerified` to response |
| `components/home/OwnProductsSection.tsx` | Verified badge on product card |
| RBAC permission registry | Add `"products.verify"` key |
| Tests | Unit tests for action; component tests for toggle states |

## Out of Scope

- Bulk verify/unverify from the list view (can be added later)
- Verified filter in the admin product search (can be added later)
- Any changes to the mobile app itself (mobile team consumes `isVerified` from API)
