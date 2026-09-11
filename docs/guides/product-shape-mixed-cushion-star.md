# Guide: New product shapes (Mixed Cushion / Star)

## Prerequisites

Run migrations (or ensure enum values exist):

```bash
npm run db:migrate
```

Or apply:

```sql
ALTER TYPE "public"."product_shape" ADD VALUE IF NOT EXISTS 'Mixed Cushion';
ALTER TYPE "public"."product_shape" ADD VALUE IF NOT EXISTS 'Star';
```

## Use end-to-end

1. Open **Create product** or **Edit product** (admin or seller portal).
2. Open the **Shape** dropdown.
3. Choose **Mixed Cushion** or **Star** (listed after **Cushion**).

## Extending

1. Postgres: `ALTER TYPE product_shape ADD VALUE …`
2. `PRODUCT_SHAPES` in `features/products/schemas/gemstone-spec.ts`
3. `productShapeEnum` in `drizzle/schema/product-schema.ts`
4. Form `SHAPES` arrays and filter/facet lists
5. Docs / MOBILE-API shape lists

## Common errors

| Error | Fix |
| --- | --- |
| `invalid input value for enum product_shape` | Migration not applied — add `Star` / `Mixed Cushion` on that database |
| Still seeing **Star under Cushion** | Hard refresh; ensure app code uses `Star` (not the old label) |
