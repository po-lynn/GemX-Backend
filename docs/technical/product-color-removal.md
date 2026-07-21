# Product Color: Removed the Managed Color Table

## What changed

Removed the `color` lookup table and the `product.colorId` foreign key entirely. Product
color is now a plain free-text column only — the same pattern `productJewelleryGemstone.color`
and the portal seller form already used.

**Deleted:**
- `drizzle/schema/color-schema.ts` (the `color` table) and its re-export from `drizzle/schema.ts`
- `features/colors/` (db helpers, cache, Zod schemas, permissions, `ColorForm`/`ColorListView` components)
- `app/admin/colors/` (admin CRUD pages)
- `app/api/colors/route.ts` (public `GET /api/colors` listing)
- Tests: `tests/api/colors.test.ts`, `tests/unit/color-actions.test.ts`, `tests/unit/color-schema.test.ts`,
  `tests/component/color-form.test.tsx`, `tests/component/color-list-view.test.tsx`,
  `tests/api/products/color-link.test.ts`, `tests/unit/product-actions-color.test.ts`

**Edited:**
- `drizzle/schema/product-schema.ts` — dropped `colorId` column, its FK to `color.id`, and
  `product_colorId_idx`. The pre-existing `color: text("color")` column is now the only
  color field.
- `features/products/schemas/products.ts` — removed the `colorId` field; the loose-stone
  `superRefine` rule now requires only `color` (non-empty, trimmed).
- `features/products/db/products.ts` — removed all `colorId` select/insert/update paths
  across `getAdminProductsFromDb`, `getProductsBySellerId`, `getProductById`,
  `createProductInDb`, `updateProductInDb`, and the `AdminProductRow` / `ProductForEdit` /
  `UpdateProductInput` types.
- `features/products/actions/products.ts` and `app/api/products/route.ts` /
  `app/api/products/[id]/route.ts` — removed `getColorById` resolve-and-denormalize logic.
  Color is now written through as-is; no lookup, no "Unknown colorId" 400 path.
- `features/products/components/ProductForm.tsx` — the `colorId` `<select>` (populated from
  a `colors` prop) is now a plain required `<input type="text" name="color">`. The `colors`
  prop and `ColorOption` import are gone.
- `app/admin/products/new/page.tsx`, `app/admin/products/[id]/edit/page.tsx` — removed the
  `getAllColors()` fetch and `colors` prop passed to `ProductForm`.
- `features/rbac/feature-keys.ts` — removed `FEATURE_KEYS.COLOR` and its `FEATURE_GROUPS` entry.
- `components/admin/AdminSidebar.tsx` — removed the "Color" nav item and unused `Palette` icon import.
- `lib/dataCache.ts` — removed `"color"` from the `CACHE_TAG` union.
- `docs/MOBILE-API.md` — removed section documenting `GET /api/colors`, updated create/update
  product sections to drop all `colorId` behavior.
- Deleted docs: `docs/api/colors.md`, `docs/technical/product-colors.md`,
  `docs/technical/product-form-color-dropdown.md`, `docs/guides/product-colors.md` (superseded
  by this doc).

## Data flow (after)

Create/update product → `color` (free text, required for `loose_stone`, optional for
`jewellery`) flows straight from form/API body → Zod schema → `createProductInDb` /
`updateProductInDb` → `product.color` column. No intermediate lookup, no denormalization step.

## Schema impact

`product` table: dropped `color_id` (uuid, FK to `color.id`, `ON DELETE SET NULL`) and the
`product_colorId_idx` index. The `color` table itself is dropped. `product.color` (text,
nullable) is unchanged and is now the sole color field.

**Migration:** Not generated or applied by this change — per project convention, DB migrations
are run manually. After reviewing the schema edits in `drizzle/schema/product-schema.ts` and
`drizzle/schema/color-schema.ts` (deleted), run `npm run db:generate` to produce the migration
(drops `product.color_id`, `product_colorId_idx`, and the `color` table), review the generated
SQL, then `npm run db:migrate` when ready.

## Auth & permissions

No auth changes. `canAdminManageProducts` still gates admin product create/update; the removed
`canAdminManageColor` permission predicate and `FEATURE_KEYS.COLOR` no longer exist — any RBAC
row referencing that feature key becomes inert (no runtime error; `checkFeatureAccess` simply
never matches it).

## Edge cases & known limitations

- Existing products that only had a `colorId` set (no denormalized `color` text) would have
  lost their visible color — but the create/update paths always denormalized `color` alongside
  `colorId`, so in practice every row with a `colorId` also has a matching `color` string. No
  backfill needed.
- The admin form's color field renders only for `productType === "loose_stone"`, matching the
  prior `colorId` select's visibility rule and the "color is required for loose stone" Zod check.
- Jewellery products never render (or require) a product-level color field; each
  `jewelleryGemstones[]` item keeps its own independent free-text `color`, unaffected by this change.
