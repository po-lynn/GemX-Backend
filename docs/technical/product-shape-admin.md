# Product Shape admin CRUD

## What changed

Added an admin-managed **Product Shape** lookup (same pattern as Origin / Laboratory), placed under Origin in Configuration.

| Path | Role |
| --- | --- |
| `drizzle/schema/product-shape-schema.ts` | Table `product_shapes` (`id`, `name`, timestamps) |
| `drizzle/migrations/0097_product_shapes.sql` | Create table + seed Oval/Cushion/…/Heart |
| `features/product-shape/**` | Schemas, db, cache, actions, form, list |
| `app/admin/product-shape/**` | List / new / edit pages |
| `app/api/product-shapes/route.ts` | Public `GET` list |
| `components/admin/AdminSidebar.tsx` | Menu under Origin |
| `features/rbac/feature-keys.ts` | `PRODUCT_SHAPE` / `"product_shape"` |

## Data flow

1. Admin opens **Configuration → Product Shape**.
2. Create/edit with a single **Product Shape** name field → server actions → `product_shapes` table.
3. Mobile/forms call `GET /api/product-shapes` for the list.

## Schema impact

- New table `product_shapes` (plural) — avoids clash with existing Postgres enum type `product_shape` used by `product.shape`.
- Product rows still store shape via the enum / text column; this lookup does **not** FK-link products yet.

## Auth & permissions

- Pages: `requireFeatureAccess(FEATURE_KEYS.PRODUCT_SHAPE)`
- Mutations: `canAdminManageProductShape` → `role === "admin"` only
- Public API: no auth

## Edge cases

- Deleting a shape does not clear existing product `shape` values.
- Seed inserts current enum labels if missing; re-running migration is idempotent for those names.
