# GET /api/products — `currency` query

**Endpoint:** `GET /api/products`  
**Also:** `GET /api/products/mine`, `GET /api/profile`, `GET /api/profile/:id` (embedded products)  
**Auth:** public for list; bearer for mine/profile  
**Mobile:** yes (`/api/products*`)

## Request

| Query | Type | Required | Notes |
|-------|------|----------|-------|
| `currency` | `USD` \| `MMK` | No | Exact match on `product.currency` |

Validated by `adminProductsSearchSchema` (`features/products/schemas/products.ts`).

## Response

Unchanged list envelope `{ products, total }`. Items already include `currency`.

## Example

```bash
curl "http://localhost:3000/api/products?currency=MMK&limit=5"
```

```json
{
  "products": [
    {
      "id": "...",
      "title": "...",
      "price": "1500000",
      "currency": "MMK"
    }
  ],
  "total": 12
}
```

**Errors:** same as existing list (`500`, `503` timeout). Invalid `currency` does not return 400 — parse falls back (see technical note).
