# Product Form Colour Dropdown

**Date:** 2026-07-07

## What changed

The admin product form's colour field switched from a free-text `<input
name="color">` to a `<select name="colorId">` backed by the managed
**Colors** list (`docs/technical/product-colors.md`), for loose-stone
products only (jewellery never renders this field).

Files touched:

- `features/products/components/ProductForm.tsx` — added a `colors?:
  ColorOption[] | null` prop (destructured alongside `laboratories`,
  `origins`); replaced the free-text colour `<input>` in the stone-details
  section with a `<select id="colorId" name="colorId" required
  className="pd-select">` populated from `colors`, with a `"Select color"`
  placeholder option and colour uuids as option values.
- `app/admin/products/new/page.tsx` — calls `getAllColors()` and passes
  `colors={colors}` to `<ProductForm>`.
- `app/admin/products/[id]/edit/page.tsx` — extends the existing
  `Promise.all([...])` fetch with `getAllColors()` and passes
  `colors={colors}` to `<ProductForm>`.

This is a pure form/page change — no schema, action, or API route changes.
Task 1 (`features/products/actions/products.ts`, already committed) already
parses `colorId` from FormData in `createProductAction`/`updateProductAction`
and resolves it via `getColorById`; this task just makes the form actually
submit a valid `colorId` uuid instead of a free-text `color` string.

## Data flow

```
Page (new/edit)  →  getAllColors()  →  colors: ColorOption[]
                                     ↓
              <ProductForm colors={colors} ... />
                                     ↓
   stone-details section (non-jewellery only) renders
   <select name="colorId"> populated from `colors`
                                     ↓
              form submit → FormData("colorId") = <uuid>
                                     ↓
   createProductAction / updateProductAction (Task 1, unchanged here):
     colorId = emptyToNull(formData.get("colorId"))
     if (colorId) → getColorById(colorId)
        found     → resolvedColor = colorRow.name; store color + colorId
        not found → { error: "Unknown colorId" }
```

**Pre-selection on edit** (`defaultValue` on the `<select>`), in order:

1. `product?.colorId` — already-linked colour, if set.
2. Legacy free-text match — if `colorId` is null but `product.color` is a
   non-empty string, find a colour in `colors` whose `name` matches
   case-insensitively (`c.name.toLowerCase() === product.color.toLowerCase()`)
   and use its `id`.
3. `""` — falls back to the `"Select color"` placeholder, forcing the admin
   to explicitly re-pick (the placeholder has no `value` other than `""`,
   and the field is `required`, so the form cannot be submitted without a
   pick).

## Schema impact

None. No Drizzle schema, migration, or Zod schema changes — `colorId` was
already added to the product schema and DB columns in the "Product Colors"
feature (Task 1 groundwork). This task is UI-only.

## Auth & permissions

Unchanged. `createProductAction`/`updateProductAction` run under the same
admin-session action auth as before; `getAllColors()` (called server-side in
the page components) has no auth guard of its own, matching how
`getAllLaboratories()`/`getAllOrigins()` are fetched for the same pages.

## Edge cases & known limitations

- **Stale/unknown `colorId`.** If a `colorId` value somehow doesn't resolve
  to a row in the `color` table (e.g. race with a delete between page load
  and submit), the action returns `{ error: "Unknown colorId" }` before any
  DB write — same as the API-layer behavior documented in
  `docs/technical/product-colors.md`.
- **Legacy free-text products pre-select by name match.** A product with a
  free-text `color` (e.g. `"Blue"`) but no `colorId` will have its `<select>`
  pre-selected to the matching managed colour if one exists with the same
  name (case-insensitive); if no match exists, the select falls back to the
  empty placeholder and the admin must explicitly choose a colour to save
  the form (the field is `required`).
- **Jewellery products never render this select.** The colour dropdown only
  lives inside the stone-details section, which is conditionally rendered
  for non-jewellery product types. For jewellery, the `colorId` field is
  absent from the submitted FormData entirely. Per Task 1's action logic
  (`formData.has("colorId")` gate in `updateProductAction`), an **absent**
  `colorId` field leaves both the `color` and `colorId` columns **untouched**
  on update — it does not clear them. This differs from a **rendered-but-
  empty** select (only possible for loose-stone products, since `required`
  blocks an actual empty submit, but relevant for any other caller sending
  an empty string): that clears both `colorId` and `color` to `null`. In
  short: absence ≠ intentional-clear; an explicit empty value = clear.
- **Jewellery gemstone rows remain free text by design.** The per-gemstone
  `color` inputs inside `jewelleryGemstones[]` (a separate, repeatable
  sub-form) are untouched by this change and stay plain `<input type="text">`
  fields — `colorId` is a product-level concept only, never applied to
  individual gemstone rows.
