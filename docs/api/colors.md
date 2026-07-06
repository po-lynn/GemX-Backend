# Colors — API Reference

## Endpoint

**GET** `/api/colors`

**Auth:** Public — no session or bearer token required.

**Mobile flag:** Yes. Consumed by the mobile app to populate the colour
picker on the product create/edit screens (loose stones, jewellery, and
jewellery gemstone rows).

## Request

No path params, no query params, no body.

```bash
curl https://<host>/api/colors
```

## Response

**200 OK** — array of colours, ordered by `name` ascending:

```json
[
  { "id": "6f1b6e2a-9c3a-4a3e-8b1a-1d2c3e4f5a6b", "name": "Blue", "hexCode": "#1565C0" },
  { "id": "a2c4e6f8-1234-4a3e-8b1a-1d2c3e4f5a6b", "name": "Multi-color", "hexCode": "" }
]
```

| Field     | Type   | Description |
| --------- | ------ | ----------- |
| `id`      | string | Colour UUID. Send as `colorId` on `POST /api/products` / `PATCH /api/products/:id`. |
| `name`    | string | Colour name (unique). |
| `hexCode` | string | Hex swatch (e.g. `"#1565C0"`), or `""` when the colour has no single representative swatch (seeded examples: Multi-color, Bi-color, Colorless). Render a placeholder swatch when empty. |

**500 Internal Server Error** — on unexpected DB failure:

```json
{ "error": "Failed to fetch colors" }
```

## Caching

Response headers: `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
(same convention as `GET /api/origins` and `GET /api/laboratories`). Error
responses are not cached.

## Admin mutations

There is no REST endpoint for creating, updating, or deleting colours.
Admin manages the colour list via server actions in
`features/colors/actions/color.ts` (`createColorAction`, `updateColorAction`,
`deleteColorAction`), called from the admin pages at `/admin/colors`,
`/admin/colors/new`, and `/admin/colors/[id]/edit`. These actions require an
admin session (`canAdminManageColor`) and are not reachable from mobile.

Duplicate colour names are rejected at the DB level (unique constraint on
`color.name`, Postgres error `23505`) and surfaced to the admin UI as
`"A colour with this name already exists"`.

## Using `colorId` on products

See `docs/MOBILE-API.md` (§5.5 "Create product", §5.6 "Update product") and
`docs/technical/product-colors.md` for how `colorId` is resolved into the
denormalized `product.color` text field.
