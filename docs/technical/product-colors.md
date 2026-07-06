# Product Colors

**Date:** 2026-07-06

## What changed

Added a managed **Colors** configuration list (analogous to Origin and
Laboratory) so products can be tagged with a canonical colour instead of
free-text only, while keeping the free-text `color` field for backward
compatibility and for jewellery gemstones (intentionally unlinked).

Files touched, in build order:

- `drizzle/schema/color-schema.ts` — new `color` table.
- `drizzle/schema/product-schema.ts` — added `product.colorId` (uuid FK →
  `color.id`, `ON DELETE SET NULL`) and index `product_colorId_idx`.
- `drizzle/migrations/0066_awesome_rachel_grey.sql` — generated migration:
  creates `color`, adds `product.color_id` + FK + index, seeds 20 standard
  gemstone colours. **Applied to the live DB.**
- `features/colors/schemas/color.ts` — Zod schemas: `colorCreateSchema`
  (name required, `hexCode` optional `#RRGGBB` or `""`, defaults to `""`),
  `colorUpdateSchema` (partial + `colorId`), `colorDeleteSchema`.
- `features/colors/db/color.ts` — `getAllColors`, `getColorById`,
  `createColorInDb`, `updateColorInDb`, `deleteColorInDb`.
- `features/colors/db/cache/color.ts` — `"use cache"`-wrapped
  `getCachedColors` / `getCachedColorById` with `cacheTag`/`updateTag`
  (`color` global tag + per-id tag via `getGlobalTag`/`getIdTag`), and
  `revalidateColorCache(id?)`.
- `features/colors/permissions/color.ts` — `canAdminManageColor(role)` →
  `role === "admin"` (admin-role only, same pattern as categories).
- `features/colors/actions/color.ts` — `createColorAction`,
  `updateColorAction`, `deleteColorAction` server actions; catch Postgres
  `23505` (unique violation on `color.name`) and return
  `{ error: "A colour with this name already exists" }` instead of throwing.
- `features/rbac/feature-keys.ts` — `FEATURE_KEYS.COLOR = "color"` added to
  the `Marketplace` feature group with label `"Color"`.
- `app/api/colors/route.ts` — public `GET /api/colors`.
- `features/colors/components/ColorListView.tsx`, `ColorForm.tsx`,
  `components/index.ts` — admin list (with swatch previews via
  `ColorSwatch`) and create/edit form (name + hex picker, danger-zone
  delete on edit).
- `app/admin/colors/page.tsx`, `app/admin/colors/new/page.tsx`,
  `app/admin/colors/[id]/edit/page.tsx` (+ `loading.tsx` siblings) — admin
  pages, each gated with `requireFeatureAccess(FEATURE_KEYS.COLOR)`.
- `components/admin/AdminSidebar.tsx` — Color link added to the
  Configuration sub-menu (see `docs/technical/admin-sidebar-configuration-submenu.md`).
- `features/products/schemas/products.ts` — `colorId` (uuid, optional,
  nullable) added to the product create/update schema; the loose-stone
  "color is required" refinement now passes when **either** `color` or
  `colorId` is present.
- `app/api/products/route.ts` (POST) and `app/api/products/[id]/route.ts`
  (PATCH) — resolve `colorId` → `color` row → denormalized name; store both
  `color` and `colorId`.
- `features/products/db/products.ts` — `colorId` threaded through the
  create/update input types, the DB insert/update column list, and both the
  list and detail response mappers.

## Data flow

**Admin management:**

```
Admin form (ColorForm)  →  createColorAction / updateColorAction / deleteColorAction
                            (canAdminManageColor guard, Zod validation)
                        →  createColorInDb / updateColorInDb / deleteColorInDb
                        →  revalidateColorCache(id?)  (updateTag on global + per-id tags)
```

`app/admin/colors/page.tsx` reads via `getAllColors()` directly (uncached,
always fresh list for the admin table). `app/admin/colors/[id]/edit/page.tsx`
reads the single row via the cached `getCachedColorById`.

**Mobile / public consumption + product write:**

```
GET /api/colors  →  getAllColors()  →  [{ id, name, hexCode }]
                     (HTTP Cache-Control: public, s-maxage=60, swr=300)
                                     ↓
              client colour picker (mobile app / future web form)
                                     ↓
POST /api/products or PATCH /api/products/:id  body: { ..., colorId }
                                     ↓
   parsed.data.colorId present?  →  getColorById(colorId)
        found  → resolvedColor = colorRow.name
                 stored: color = resolvedColor, colorId = colorId
        not found → 400 { "error": "Unknown colorId" }  (before any
                     point deduction or DB write)
        absent  →  resolvedColor = parsed.data.color (plain string path,
                     colorId persisted as null)
```

Note the two API route files duplicate this resolution logic independently
(`app/api/products/route.ts` for POST, `app/api/products/[id]/route.ts` for
PATCH) — there is no shared helper.

`GET /api/products` (list) and `GET /api/products/:id` (detail) both include
`colorId` in their response mapping (`features/products/db/products.ts`),
alongside the existing free-text `color`.

## Schema impact

**New table `color`:**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `default gen_random_uuid()` |
| `name` | text | `NOT NULL UNIQUE` |
| `hex_code` | text | `NOT NULL DEFAULT ''` |
| `created_at` | timestamp | `default now()` |
| `updated_at` | timestamp | `default now()`, `$onUpdate` |

Seeded (migration `0066_awesome_rachel_grey.sql`, `ON CONFLICT (name) DO
NOTHING`) with 20 rows: Red, Pink, Blue, Green, Yellow, Orange, Purple,
Violet, White, Colorless (`hex_code = ''`), Black, Brown, Gray, Golden,
Multi-color (`''`), Bi-color (`''`), Padparadscha, Pigeon Blood Red, Royal
Blue, Cornflower Blue.

**`product` table:** added `color_id uuid` (nullable) with
`FOREIGN KEY (color_id) REFERENCES color(id) ON DELETE SET NULL` and
`CREATE INDEX product_colorId_idx ON product (color_id)`. The pre-existing
`product.color` text column is unchanged and continues to hold the
free-text/denormalized colour name.

Migration `0066_awesome_rachel_grey.sql` has already been applied to the
live database — no pending `npm run db:migrate` step for this feature. Any
fresh environment (new dev DB, staging, CI) still needs the normal
`npm run db:migrate` to pick it up.

## Auth & permissions

| Surface | Guard |
| --- | --- |
| `GET /api/colors` | Public, no auth |
| `/admin/colors`, `/admin/colors/new`, `/admin/colors/[id]/edit` | `requireFeatureAccess(FEATURE_KEYS.COLOR)` — RBAC feature key, configurable per role via the permissions UI |
| `createColorAction`, `updateColorAction`, `deleteColorAction` | `requireActionRole(canAdminManageColor)` → hard-coded `role === "admin"` (admin role only, cannot be delegated via RBAC feature flags, matching the Category pattern) |
| `POST /api/products`, `PATCH /api/products/:id` (`colorId` field) | Same auth as the rest of product create/update: any authenticated user (session bearer/cookie) for create; owner-or-admin for update |

Note the split: **viewing/managing the colour list itself** in
`/admin/colors/*` is RBAC-gated per role (`FEATURE_KEYS.COLOR`), but the
underlying **server actions** additionally hard-require the `admin` role
regardless of feature flags — a non-admin role granted the `color` feature
key could see the pages but any create/update/delete action call would
return `{ error: "Unauthorized" }`.

## Edge cases & known limitations

- **Renaming a colour does not rewrite existing products.** `color` is
  denormalized at write time; updating `color.name` only affects future
  product writes that re-resolve `colorId`, and the admin colour edit form
  itself. Existing products keep their old text until re-saved.
- **PATCH clears a stale `colorId` link when only `color` text is sent.**
  If a product already has `colorId` set and a later `PATCH` request sends
  `color` without a `colorId` key, the route sets `colorId = null` (in
  addition to storing the new `color` text) so the two columns never
  disagree. Sending `colorId: null` explicitly clears the link the same
  way; omitting both fields leaves both columns untouched.
- **Deleting a colour nulls `colorId` but keeps the text.** The FK is
  `ON DELETE SET NULL`; the product's `color` text field is untouched, so a
  deleted colour's name may linger as plain text on old listings with no
  live `colorId` link.
- **Duplicate names are rejected** at the DB unique constraint
  (`color_name_unique`); the server action maps Postgres `23505` to a
  user-facing `"A colour with this name already exists"` message rather
  than a raw DB error.
- **Jewellery gemstones (`jewelleryGemstones[]`) are intentionally
  unlinked.** Each gemstone keeps its own free-text `color`; `colorId` is
  only a product-level field and is never read from or applied to gemstone
  array items.
- **`colorId: ""` is a validation error, not a null.** Unlike
  `laboratoryId` (which has no such normalization either, for reference),
  the Zod schema is `z.string().uuid().optional().nullable()` — an empty
  string fails `.uuid()` and returns a generic Zod `400` with `details`,
  distinct from the custom `"Unknown colorId"` message (which only fires
  for a syntactically valid UUID that doesn't exist in the `color` table).
- **Admin/seller web product form is still free-text `color`.** The
  `colorId` field is only wired into the API layer (`POST`/`PATCH
  /api/products`) for the mobile app; no follow-up wiring the admin web
  product form's colour input to the managed list has been done yet.
- **No colour filtering on product search/list.** `adminProductsSearchSchema`
  / `getAdminProductsFromDb` do not currently accept a `colorId` filter.
