# Product list `currency` filter

## Prerequisites

None — uses existing `product.currency` (`USD` | `MMK`).

## Use

```bash
# USD listings only
curl "http://localhost:3000/api/products?currency=USD&page=1&limit=20"

# MMK + type
curl "http://localhost:3000/api/products?currency=MMK&productType=loose_stone"

# Seller inventory
curl "http://localhost:3000/api/products/mine?currency=USD" \
  -H "Authorization: Bearer <token>"
```

Same param on **GET `/api/profile`** and **GET `/api/profile/:id`** product lists.

## Extend

To add another exact-match enum filter:

1. Add to `adminProductsSearchSchema`
2. Thread through list DB opts + `eq(product.<col>, …)` in both list functions (+ facets if needed)
3. Pass from each GET route’s `searchParams`
4. Update `docs/MOBILE-API.md` §5.1

## Common errors

| Symptom | Cause | Fix |
|---------|--------|-----|
| Filter ignored / unexpected empty page | Invalid enum → whole query parse falls back to page 1 | Send exact `USD` or `MMK` (case-sensitive) |
| Empty with price filters | `currency` AND conflicting `priceMinMMK` / `priceMinUSD` | Use matching currency for price range |
