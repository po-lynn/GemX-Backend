# Product Form Colour Dropdown — Design

**Date:** 2026-07-06
**Status:** Approved

## Goal

Replace the free-text **Color** input in the admin/web product form with a
dropdown fed by the managed colour list, submitting `colorId` so web-created
products populate the `product.colorId` FK with the denormalized colour name
— the same semantics the mobile API already has.

## Scope decision

**Product-level colour only.** Jewellery gemstone rows keep their free-text
colour boxes (per the colours feature spec, gemstone rows have no FK).

## Design

### Pages

`app/admin/products/new/page.tsx` and
`app/admin/products/[id]/edit/page.tsx` additionally call `getAllColors()`
(from `@/features/colors/db/color`) and pass `colors` to `ProductForm` —
exactly how `origins` / `laboratories` flow today.

### Form (`features/products/components/ProductForm.tsx`)

- New prop: `colors?: ColorOption[] | null` (beside `laboratories`).
- The free-text Color input in the stone-details section becomes:

```tsx
<select id="colorId" name="colorId" required defaultValue={...} className="pd-select">
  <option value="">Select color</option>
  {(colors ?? []).map((c) => (
    <option key={c.id} value={c.id}>{c.name}</option>
  ))}
</select>
```

- `required` applies exactly where the old input was required (the section
  renders only for non-jewellery products).
- **Pre-selection on edit:** `product.colorId` when set; otherwise, if the
  product has legacy free-text `color`, pre-select the list entry whose name
  matches case-insensitively; otherwise empty ("Select color").
- Options show plain names — a native `<select>` cannot render swatch dots;
  accepted trade-off.

### Server actions (`features/products/actions/products.ts`)

Both `createProductAction` and `updateProductAction`:

- Parse `colorId: emptyToNull(formData.get("colorId"))` into the existing
  Zod field (`productCreateSchema` / `productUpdateSchema` already accept
  `colorId` as nullable uuid from the mobile-API work).
- After validation:
  - `colorId` present → resolve via `getColorById`; unknown id → return
    `{ error: "Unknown colorId" }` before any DB write; known id → pass
    `colorId` and `color = resolvedName` to the DB layer.
  - `colorId` empty/null → pass `colorId: null` and `color: null` — link
    and denormalized text stay in sync (mirrors the PATCH-route invariant).
- The DB layer already threads `colorId` end-to-end — no changes there.

### Error handling & edge cases

- Unknown/stale `colorId` (colour deleted between page load and submit) →
  friendly action error, nothing persisted.
- Legacy product with free-text colour not in the list → dropdown shows
  "Select color"; the user must pick before saving (acceptable: no
  production data).
- Jewellery products don't render the section; `colorId` is absent from the
  FormData → parsed as null → colour columns cleared/null, same as today.

## Testing

- `tests/unit/product-actions-color.test.ts` (or extend existing action
  tests if present): create with `colorId` resolves and denormalizes the
  name; unknown `colorId` → error, no DB write; empty select → both
  `colorId` and `color` null.
- Docs per CLAUDE.md: short technical note
  (`docs/technical/product-form-color-dropdown.md`) and an update to
  `docs/guides/product-colors.md` (the web form now uses the managed list —
  replaces its "follow-up" note).

## Out of scope

- Jewellery gemstone row colour fields (free text).
- Mobile API (unchanged).
- Custom dropdown with swatch rendering.
