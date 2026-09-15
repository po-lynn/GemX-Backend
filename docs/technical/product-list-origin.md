# Product list — `origin` field

## What changed

Public and seller product **list** responses now include `origin` (string or `null`), matching the free-text column already returned on product detail.

**Files touched:**

- `features/products/db/products.ts` — `AdminProductRow.origin`; selected/mapped in `getAdminProductsFromDb` and `getProductsBySellerId`
- `app/api/products/route.ts` — `maskCollectorPiece` sets `origin: null` (and `shape: null`) for masked collector pieces
- `docs/MOBILE-API.md`, `docs/api/products.md` — response examples
- `tests/api/products/route.test.ts` — list + mask coverage

## Data flow

```
product.origin (text, nullable)
  → getAdminProductsFromDb / getProductsBySellerId select
  → AdminProductRow.origin
  → GET /api/products (toPublicProductListItem / maskCollectorPiece)
  → GET /api/products/mine
  → GET /api/profile and /api/profile/:id (products[])
```

Detail (`getProductById` → `GET /api/products/:id`) already returned `origin` and `jewelleryGemstones[].origin`; unchanged.

`origin` remains denormalized free text (typically a **name** from the `origin` lookup table / `GET /api/origins`). There is no FK from `product` to `origin`.

## Schema impact

None — `product.origin` already exists. No migration.

## Auth & permissions

| Endpoint | Auth | Origin behaviour |
|----------|------|------------------|
| `GET /api/products` | Public | Full value on normal items; `null` when collector piece is masked |
| `GET /api/products/mine` | Bearer / session | Full value (owner list, no public mask) |
| `GET /api/profile*` products | Bearer / session | Full value via `getProductsBySellerId` |
| `GET /api/products/:id` | Public († collector gate) | Already included on full detail |

## Edge cases

- Missing / empty DB value → `null` in JSON
- Masked collector browse → `origin` forced to `null` even if stored
- Filter `?origin=` continues to match `product.origin` (unchanged)
