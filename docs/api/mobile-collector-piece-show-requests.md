# Mobile: Collector piece show requests

## GET `/api/mobile/collector-piece-show-requests`

**Auth:** Bearer session (required).

**Query:** `page` (default 1), `limit` (default 10, max 50).

**200:** `{ "requests": [...], "page", "limit", "total" }`

Each **`requests`** item includes:

- `id`, `productId`, `status`, `message`, `createdAt`
- **`productName`** — `product.title` for the linked product
- **`sellerName`** — `user.name` for `product.seller_id`

**401:** `{ "error": "Unauthorized" }`

**500:** `{ "error": "Failed to load requests" }`

## POST `/api/mobile/collector-piece-show-requests`

Submit a new request. See `docs/MOBILE-API.md` section **5.4.4**.

## Mobile

Yes — `/api/mobile/*`.
