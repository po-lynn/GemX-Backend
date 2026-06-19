# Featured Expire Date — Design Spec

**Date:** 2026-06-19  
**Status:** Approved

## Summary

When a product is marked as Featured, the admin edit form will show a date picker pre-filled from the selected pricing tier. The admin can override the date freely. The exact date is submitted to the backend and stored directly — replacing the current auto-calculation from `featuredDurationDays`.

No schema migration is needed: `featuredExpiresAt` already exists on the `product` table.

---

## UI / Form

File: `features/products/components/ProductForm.tsx`

Inside the existing `{isFeatured && ...}` block, below the tier dropdown, add a date input:

```
[ Tier: 30 days — 100 pts  ▼ ]
[ Expires on: 2026-07-19   📅 ]   ← new
```

**Behaviour:**
- Selecting a tier auto-fills the date input with `today + durationDays` (client-side, no server round-trip).
- Admin can freely edit the date — the tier stays selected for its points cost.
- Unchecking "Featured" hides the date input (same as the tier dropdown today).
- The date input submits as `featuredExpiresAt` in `YYYY-MM-DD` format.
- Existing featured products pre-fill the date from their saved `featuredExpiresAt`; if none saved, the input is empty until a tier is selected.

**State additions:**
- `featuredExpiresAt: string` — controlled state for the date input, initialized from `product?.featuredExpiresAt` (formatted to `YYYY-MM-DD`).
- Effect: when `selectedFeatureTier` changes, recalculate `today + durationDays` and update `featuredExpiresAt` state.

---

## Backend / Data Flow

### Zod schema (`features/products/schemas/products.ts`)
Add to the product update schema:
```ts
featuredExpiresAt: z.coerce.date().optional().nullable()
```

### Server action (`features/products/actions/products.ts`)
- Read `featuredExpiresAt` from `formData.get("featuredExpiresAt")`.
- Pass it into `updateProductInDb` alongside existing fields.
- Points deduction logic is unchanged — still driven by tier points.

### DB update (`features/products/db/products.ts`)
Replace the auto-calculation block:
```ts
// BEFORE
updates.featuredExpiresAt = isFeaturedNext && days > 0
  ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  : null
```
With:
```ts
// AFTER
updates.featuredExpiresAt = isFeaturedNext && expiresAt ? expiresAt : null
```
Where `expiresAt` is the `Date | null` passed in from the action.

`featuredDurationDays` continues to be stored from the tier selection for read-back consistency.

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Date set in the past | Allowed — product immediately stops appearing in featured listings (existing `featuredExpiresAt > now()` filter handles it) |
| isFeatured checked, date left blank | `featuredExpiresAt = null` — featured indefinitely |
| Tier selected, date manually cleared | `null` stored — indefinite featured, tier's points cost still deducted |
| Existing product with no saved expiry | Date input empty until a tier is selected, then auto-fills |
| isFeatured unchecked | `featuredExpiresAt = null`, `featured = 0` (unchanged from today) |

---

## Files Touched

| File | Change |
|---|---|
| `features/products/components/ProductForm.tsx` | Add `featuredExpiresAt` state + date input + tier-change effect |
| `features/products/schemas/products.ts` | Add `featuredExpiresAt` to update Zod schema |
| `features/products/actions/products.ts` | Read and forward `featuredExpiresAt` from formData |
| `features/products/db/products.ts` | Accept `featuredExpiresAt` directly, remove auto-calc |

No migration needed — column already exists.

---

## Out of Scope

- Mobile API — featured expiry already works via the existing `featuredExpiresAt > now()` query filter; no mobile changes needed.
- Notification when a featured listing expires — not requested.
- Bulk-setting expire dates across multiple products — not requested.
