# Product Colors Configuration — Design

**Date:** 2026-07-05
**Status:** Approved (amended same day: products link to colours via a
`colorId` foreign key + denormalized name, replacing the original
lookup-list-only decision — there is no production data yet and the mobile
API can change)

## Goal

Add a managed **Color** list for product colours used by Gemstones,
Loose Stones, and Jewellery. Ships with the standard gemstone colours seeded;
admins can add, edit, and delete colours from a new **Color** entry in the
admin sidebar's Configuration sub-menu. Products link to colours via a
foreign key; the mobile app and web forms consume the list via a public API
to populate colour pickers.

## Key decisions

- **FK + denormalized name (the laboratory pattern).** `product` and
  `product_jewellery_gemstone` gain a `colorId` uuid FK
  (`onDelete: "set null"`) alongside their existing `color` text columns —
  exactly how `laboratoryId` coexists with `certLabName`. When a request
  supplies `colorId`, the server resolves it and writes the colour's name
  into `color`; a plain `color` string without `colorId` is still accepted
  and stored as-is. Responses keep the `color` string and add `colorId`, so
  read paths don't break.
- **Mirror the Origin feature.** Server actions for admin CRUD, admin pages,
  and a public cached `GET /api/colors` — not REST admin routes.
- **Fields:** `name` + optional `hexCode` swatch. No sort order (alphabetical
  ordering by name).

## Schema

`drizzle/schema/color-schema.ts`, exported through `drizzle/schema.ts`:

```ts
export const color = pgTable("color", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  hexCode: text("hex_code").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow()
    .$onUpdate(() => new Date()).notNull(),
});
```

- `name` is unique — required for idempotent seeding and sensible for a
  lookup table.
- `hexCode` is `""` when the colour has no single swatch (Multi-color,
  Bi-color, Colorless).

### Product links

In `drizzle/schema/product-schema.ts`:

```ts
// on product (beside the existing color: text("color"))
colorId: uuid("color_id").references(() => color.id, { onDelete: "set null" }),

// on productJewelleryGemstone (beside its color text column)
colorId: uuid("color_id").references(() => color.id, { onDelete: "set null" }),
```

Plus indexes `product_colorId_idx` and
`product_jewellery_gemstone_colorId_idx` (mirroring
`product_laboratoryId_idx`).

### Seed data (in the generated migration)

Appended to the migration as
`INSERT INTO "color" (name, hex_code) VALUES ... ON CONFLICT (name) DO NOTHING;`

| Name | Hex | Name | Hex |
|------|-----|------|-----|
| Red | #D32F2F | Gray | #9E9E9E |
| Pink | #E91E63 | Golden | #D4AF37 |
| Blue | #1565C0 | Multi-color | *(empty)* |
| Green | #2E7D32 | Bi-color | *(empty)* |
| Yellow | #F9A825 | Padparadscha | #F88379 |
| Orange | #EF6C00 | Pigeon Blood Red | #9B111E |
| Purple | #6A1B9A | Royal Blue | #002366 |
| Violet | #7F00FF | Cornflower Blue | #6495ED |
| White | #FFFFFF | Colorless | *(empty)* |
| Black | #000000 | Brown | #6D4C41 |

## Feature module — `features/colors/`

Mirrors `features/origin/` file-for-file:

| File | Contents |
|------|----------|
| `db/color.ts` | `getAllColors` (ordered by name), `getColorById`, `createColor`, `updateColor`, `deleteColor` |
| `db/cache/color.ts` | Cache tag helpers (same shape as origin's) |
| `schemas/color.ts` | Zod: `name` trimmed, 1–100 chars, required; `hexCode` optional — `""` or `/^#[0-9a-fA-F]{6}$/` |
| `permissions/color.ts` | Permission checks mirroring `features/origin/permissions/origin.ts` |
| `actions/color.ts` | Server actions: create / update / delete, RBAC-gated, revalidate cache tag |
| `components/ColorListView.tsx` | Table: swatch dot, name, hex, updated date, edit/delete actions |
| `components/ColorForm.tsx` | Name input; hex input paired with a native colour picker and live swatch preview; used by both new and edit pages |
| `components/index.ts` | Re-exports |

### RBAC

New key in `features/rbac/feature-keys.ts`:
`COLOR: "color"`, labelled **Color** in the Master Data group (beside Origin
and Laboratory).

## Admin pages

Copied from `app/admin/origin/`:

- `app/admin/colors/page.tsx` (+ `loading.tsx`) — list view
- `app/admin/colors/new/page.tsx` (+ `loading.tsx`) — create form
- `app/admin/colors/[id]/edit/page.tsx` (+ `loading.tsx`) — edit form

## API

`GET /api/colors` — public, no auth, `jsonCached` (same as `/api/origins`).
Response: `{ id, name, hexCode }[]` ordered by name. Consumed by the mobile
app to populate colour pickers for gemstones, loose stones, and jewellery
gemstone specs. 500 with `jsonError` on failure.

No mutation API routes for colours themselves — admin create/edit/delete go
through server actions.

### Product API changes (mobile)

`POST /api/products` and `PATCH /api/products/:id`:

- Product body accepts optional `colorId` (UUID from `GET /api/colors`).
  If present, the server resolves it and stores the colour's name in
  `color`; an unknown `colorId` → 400 with a clear message. A plain `color`
  string without `colorId` remains valid (stored with `colorId = null`).
  Sending both keeps the resolved name (colorId wins).
- Each `jewelleryGemstones[]` item accepts optional `colorId` with the same
  resolve-and-denormalize behaviour.
- Loose-stone validation "color is required" is satisfied by either
  `colorId` or `color`.
- Product responses additionally include `colorId` at product level and on
  each jewellery gemstone.
- `docs/MOBILE-API.md` is updated accordingly.

## Sidebar

One child appended to the existing Configuration sub-menu in
`components/admin/AdminSidebar.tsx`:

```
⚙️ Configuration
    …existing children…
    🎨 Color → /admin/colors   (Palette icon, featureKey: color)
```

Visibility follows the existing rules: admins always see it; staff need the
`color` feature key.

## Error handling & edge cases

- Duplicate name on create/update → unique-violation surfaced as a friendly
  "colour already exists" form error.
- Invalid hex → Zod rejects before hitting the DB.
- Deleting a colour sets `colorId` to null on referencing products and
  jewellery gemstones; the denormalized `color` name text is untouched, so
  listings keep displaying the colour.
- Renaming a colour does not rewrite existing products' `color` text (the
  name was denormalized at save time) — documented as a known limitation.
- Unknown `colorId` in a product request → 400, nothing persisted.
- Empty list → list view shows the standard empty state; API returns `[]`.

## Testing

- `tests/unit/color-schema.test.ts` — Zod schema: valid names, trim, length
  limits, hex format (accepts `""`, `#9B111E`; rejects `9B111E`, `#XYZ`).
- `tests/api/colors.test.ts` — `GET /api/colors` happy path (mock Drizzle)
  and DB-failure 500.
- `tests/api/products-color-link.test.ts` — product create/update with a
  valid `colorId` (name denormalized), unknown `colorId` → 400, plain
  `color` string still accepted, jewellery gemstone `colorId` handling.
- `tests/component/color-list-form.test.tsx` — list renders rows with
  swatches; form validates and submits; edit pre-fills.
- Sidebar coverage: extend the existing configuration sub-menu test with the
  Color child.

## Required docs (per CLAUDE.md)

- `docs/technical/product-colors.md`
- `docs/guides/product-colors.md`
- `docs/api/colors.md`

## Out of scope

- Dropping the `color` text columns (kept as the denormalized display name).
- Backfilling `colorId` on any pre-existing rows (there is no production
  data yet).
- Colour filtering/search on product listings.
- Sort-order management (list is alphabetical).
