# Guide: Product Shape (admin)

## Prerequisites

```bash
npm run db:migrate
```

Or apply `drizzle/migrations/0097_product_shapes.sql` manually.

## Use end-to-end

1. Go to **Admin → Master Data → Configuration → Product Shape** (directly under Origin).
2. Click **New shape**, enter **Product Shape** (e.g. `Emerald Cut`), save.
3. Edit or delete from the list / edit page.
4. Mobile or product forms: `GET /api/product-shapes`.

## Extending

- Wire product create/edit dropdowns to this API instead of hardcoded `PRODUCT_SHAPES` when ready.
- Optional later: migrate `product.shape` off the Postgres enum onto free text / FK.

## Common errors

| Error | Fix |
| --- | --- |
| Table `product_shapes` does not exist | Run migration 0097 |
| Unauthorized on save | Must be `admin` role |
| Menu missing | Grant feature key `product_shape` (or use admin) |
