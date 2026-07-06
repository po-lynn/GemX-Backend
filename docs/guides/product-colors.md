# Guide: Product Colors

A managed **Colors** list (name + optional hex swatch) that products can
link to via `colorId`, alongside the existing free-text `color` field.

## Prerequisites

- Migration `0066_awesome_rachel_grey.sql` applied (already applied to the
  live DB; run `npm run db:migrate` on any fresh environment).
- No new environment variables.

## Managing colours (admin)

1. In the admin sidebar, open **Configuration** (under Master Data) →
   **Color**. Requires the `color` RBAC feature key for your role (or the
   `admin` role, which always has access).
2. **List** (`/admin/colors`) shows every colour with a swatch preview
   (or a placeholder when `hexCode` is `""`).
3. **Add** (`/admin/colors/new`): enter a `name` (required, must be
   unique) and an optional `hexCode` (`#RRGGBB`, e.g. `#1565C0`). Leave the
   hex blank for multi-tone colours like "Multi-color" or "Bi-color".
4. **Edit** (`/admin/colors/[id]/edit`): change name/hex, or use the
   danger-zone **Delete**. Note: creating/updating/deleting all require the
   `admin` role specifically — a non-admin with the `color` feature key can
   view these pages but action calls will fail with "Unauthorized".

## Consuming colours (mobile / API clients)

Fetch the list once (cacheable for ~60s):

```bash
curl https://<host>/api/colors
```

```json
[
  { "id": "6f1b6e2a-9c3a-4a3e-8b1a-1d2c3e4f5a6b", "name": "Blue", "hexCode": "#1565C0" }
]
```

Send the chosen `id` as `colorId` when creating or updating a product:

```json
POST /api/products
{
  "title": "Blue Sapphire 2ct",
  "price": "2500",
  "identification": "Natural",
  "weightCarat": "2",
  "colorId": "6f1b6e2a-9c3a-4a3e-8b1a-1d2c3e4f5a6b",
  "origin": "Myanmar",
  "productType": "loose_stone"
}
```

The server looks up the colour, writes its `name` into the product's
`color` field automatically, and stores the `id` in `colorId` — you don't
need to also send `color`. You can still send a plain `color` string
instead of `colorId` if you don't have a matching managed colour (e.g. a
custom shade); the two are independent, but if both are sent the resolved
name from `colorId` wins.

`colorId` only applies at the **product level** — it is not accepted on
individual `jewelleryGemstones[]` items, which keep their own free-text
`color`.

## Extending

**Add a field to the colour** (e.g. a `sortOrder` or `family` column):

1. `drizzle/schema/color-schema.ts` — add the column.
2. `npm run db:generate` then `npm run db:migrate`.
3. `features/colors/db/color.ts` — include it in the `select`s and accept
   it in `createColorInDb`/`updateColorInDb`.
4. `features/colors/schemas/color.ts` — add Zod validation.
5. `features/colors/components/ColorForm.tsx` — add the form input.
6. `features/colors/components/ColorListView.tsx` — show it in the list if
   useful.

**Add colour filtering to the product list/search:**

- `features/products/schemas/products.ts` —
  `adminProductsSearchSchema` currently has no `colorId` filter; add one
  there (mirror how `laboratoryId` or `categoryId` are filtered, if
  present).
- `features/products/db/products.ts` — `getAdminProductsFromDb` builds the
  `where` clause from the search params; add a `colorId` condition there.

## Common errors

- **`400 { "error": "Unknown colorId" }`** — the `colorId` sent doesn't
  exist in the `color` table. Usually a stale client-side cache of the
  colour list after an admin deleted that colour; refetch
  `GET /api/colors` and let the user re-pick.
- **`400` with a Zod `details` object, `colorId` field** — `colorId` was
  sent as an empty string or a non-UUID value. Omit the field entirely
  (send `null` or leave it out) rather than sending `""`.
- **`"A colour with this name already exists"`** — shown in the admin
  create/edit form when the `name` collides with an existing colour
  (case-sensitive exact match on the DB unique constraint).
- **`relation "color" does not exist`** (DB error) — migration `0066` has
  not been applied in that environment. Run `npm run db:migrate`.
