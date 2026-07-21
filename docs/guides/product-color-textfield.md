# Product Color: Free-Text Field (No Managed Color Table)

Product color used to be a managed lookup table (`color`) with a `colorId` foreign key on
`product`, plus an admin CRUD screen and a `GET /api/colors` picker endpoint. All of that has
been removed. Color is now a plain free-text field, same as `origin` on jewellery gemstone
items always was.

## Prerequisites

None beyond the normal dev setup (`npm run dev`, local Postgres via `DATABASE_URL`). No new
env vars.

## Using the feature

**Admin product form** (`features/products/components/ProductForm.tsx`): for `productType ===
"loose_stone"`, there's a required text input labeled "Color" bound to `name="color"`. It's
just a `<input type="text">` — type any string (e.g. "Pigeon Blood Red"). No dropdown, no
admin-managed list to keep in sync.

**API** (`POST /api/products`, `PATCH /api/products/:id`, and the equivalent server actions in
`features/products/actions/products.ts`): send `color` as a plain string.

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "title": "Ruby",
    "price": "2500",
    "productType": "loose_stone",
    "categoryId": "<category-uuid>",
    "weightCarat": "2.5",
    "color": "Pigeon Blood Red",
    "origin": "Myanmar"
  }'
```

For loose stones, `color` is required (non-empty after trimming) — same rule as before, just
enforced on the text field directly instead of "colorId or color".

Jewellery products don't have a product-level color field at all; each item in
`jewelleryGemstones[]` carries its own independent `color` string (unchanged by this removal).

## Extending it

There's no lookup table to extend anymore. If you need color-based filtering or analytics,
query `product.color` as free text (e.g. `ILIKE`), or reintroduce a managed table if strict
taxonomy is needed again — but that's a new feature, not a revert of this one.

## Common errors

- **"Color is required for loose stone"** — the `color` field was empty or all-whitespace on
  a `loose_stone` product. Fill in any non-empty string.
- **Stale `colorId` in a request body** — if an old client still sends `colorId`, it's silently
  ignored (Zod strips unknown keys); it is not validated and does not affect persistence.
- **TypeScript errors mentioning `ColorOption`, `colorId`, or `features/colors`** — you're
  looking at code from before this change; those types/modules no longer exist. Use `color:
  string | null` directly.
