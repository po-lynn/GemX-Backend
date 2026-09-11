# Product shapes: Mixed Cushion & Star

## What changed

Added two `product_shape` enum values used by create/edit product dropdowns (admin + portal):

| Value | Position |
| --- | --- |
| `Mixed Cushion` | After `Cushion` |
| `Star` | After `Mixed Cushion` |

## Files

| Path | Role |
| --- | --- |
| `drizzle/schema/product-schema.ts` | `product_shape` enum |
| `drizzle/migrations/0088_product_shape_mixed_cushion_star.sql` | `ALTER TYPE … ADD VALUE` |
| `drizzle/migrations/0089_bright_toro.sql` | Same values (idempotent `IF NOT EXISTS`) |
| `features/products/schemas/gemstone-spec.ts` | `PRODUCT_SHAPES` / Zod |
| `features/products/components/ProductForm.tsx` | Admin create/edit dropdown |
| `components/portal/PortalProductForm.tsx` | Portal create/edit dropdown |
| Filters / facets / MOBILE-API | Align list + facet counts |

## Data flow

```
ProductForm / PortalProductForm SHAPES
  → productShapeSchema / product_shape enum
  → product.shape column
```

## Schema

```sql
ALTER TYPE "public"."product_shape" ADD VALUE IF NOT EXISTS 'Mixed Cushion';
ALTER TYPE "public"."product_shape" ADD VALUE IF NOT EXISTS 'Star';
```

If a local DB previously received `Star under Cushion` via `db:push`, that orphaned enum label may remain in Postgres (enum values cannot be dropped easily) but is unused by the app. Run migrate or push so `Star` exists.

## Auth

Unchanged (same product create/edit auth).
