# Product list — `currency` filter

## What changed

Optional query param **`currency`** (`USD` | `MMK`) filters product list results by exact match on `product.currency`.

**Files touched:**

- `features/products/schemas/products.ts` — `adminProductsSearchSchema.currency`
- `features/products/db/products.ts` — `getAdminProductsFromDb`, `getProductsBySellerId`, `getAdminProductFacetCounts`
- `features/products/db/cache/products.ts` — opts types for cached wrappers
- `app/api/products/route.ts`, `app/api/products/mine/route.ts`
- `app/api/profile/route.ts`, `app/api/profile/[id]/route.ts`
- `docs/MOBILE-API.md`, `docs/api/products.md`, `docs/api/profile.md`
- `tests/unit/admin-products-search-schema.test.ts`, `tests/api/products/route.test.ts`

## Data flow

```
?currency=USD|MMK
  → adminProductsSearchSchema
  → getAdminProductsFromDb / getProductsBySellerId
  → eq(product.currency, opts.currency)
```

AND-combined with existing filters (`search`, `productType`, `origin`, etc.). Omit param → all currencies.

## Schema impact

None — uses existing `product.currency` column.

## Auth & permissions

Same as each list endpoint (public / bearer / session). Filter does not change auth.

## Edge cases

- Invalid `currency` (e.g. `EUR`) fails Zod parse; routes fall back to `{ page: 1 }` (existing enum-param behaviour — other filters on that request may also be dropped).
- Works with price-range filters; if both `currency=USD` and `priceMinMMK` are set, results must satisfy both (typically empty).
