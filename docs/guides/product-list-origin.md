# Product list `origin` field

## Prerequisites

- No new env vars or packages.
- Origins for create/edit dropdowns still come from **GET `/api/origins`**.

## End-to-end

1. Ensure products have `origin` set (create/update with e.g. `"Myanmar"`).
2. List:

```bash
curl "http://localhost:3000/api/products?page=1&limit=20"
```

Each item includes `"origin": "Myanmar"` or `"origin": null`.

3. Mine / profile products use the same field via `getProductsBySellerId`.

## Extending

To add another denormalized product attribute to list cards:

1. Add the column to `AdminProductRow` in `features/products/db/products.ts`
2. Select + map it in both `getAdminProductsFromDb` and `getProductsBySellerId`
3. If collector masking should hide it, set it to `null` in `maskCollectorPiece` (`app/api/products/route.ts`)
4. Update `docs/MOBILE-API.md` §5.1 and `docs/api/products.md`

## Common errors

| Symptom | Cause | Fix |
|---------|--------|-----|
| `origin` missing on list | Old deploy / cache | Redeploy; list is not Redis-cached beyond HTTP `s-maxage` |
| `origin` always null on browse | Collector piece masking | Expected until show-request approved or own listing via `/mine` |
| Filter `?origin=X` empty | Name mismatch | Use exact string stored on product (usually `GET /api/origins` → `name`) |
