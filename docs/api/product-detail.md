# GET /api/products/[id]

The single product-detail endpoint — consumed by both the web marketplace and the mobile app (no separate mobile route exists). Public — no auth required, but an optional session unlocks collector-piece access.

## Auth

Public. Session is only used to determine collector-piece visibility (owner or someone with an approved `collector_piece_show_request` sees full data; everyone else sees a masked summary).

## Response 200

```json
{
  "id": "...", "sku": "...", "title": "...", "description": "...",
  "price": "500", "currency": "USD", "productType": "loose_stone",
  "isCollectorPiece": false, "isVerified": true,
  "seller": {
    "id": "...", "name": "...", "image": "https://.../avatar.jpg",
    "phone": "...", "username": "...", "displayUsername": "...",
    "rating": { "averageScore": 4.8, "totalRatings": 12 }
  },
  "precautions": [{ "id": "...", "label": "..." }]
}
```

- `seller.rating` is `null` when the rating lookup times out or the seller genuinely has no ratings yet — deliberately not distinguished on the wire (both look like "no rating data"), but internally a timeout never fabricates a fake `{ averageScore: 0, totalRatings: 0 }`.
- `precautions` falls back to `[]` on a timeout.
- Collector pieces return a masked summary (`maskedPrice`, no `title`/`description`, `requestStatus`) instead of the full shape above, unless the requester is the owner or has an approved show request.

**Errors:**
- `404 {"error": "Product not found"}`
- `500 {"error": "Failed to fetch product"}` — unexpected error
- `503 {"error": "Product is taking longer than usual to load — please retry"}` with `Retry-After: 3` — the product record or seller identity query didn't complete within 6s (both are primary/required — see `docs/technical/connection-pool-hardening.md`); safe to retry. A slow rating/precaution-tags lookup never causes this — those degrade silently to the fallbacks above instead.

**Example:**

```bash
curl "http://localhost:3000/api/products/3f8a2b1c-4d5e-4f60-8a7b-9c0d1e2f3a4b"
```

**Mobile flag:** yes — this is the product-detail screen's only data source for both web and mobile.
