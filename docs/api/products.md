# Products API

Consumed by the **mobile app** (Home tab: Featured, Privilege Assist, New Products, Collector Pieces sections) and the public web marketplace. Public — no auth required for browsing.

## GET /api/products

**Auth:** public (collector-piece browse is masked for anonymous/unapproved viewers rather than requiring auth — see below)

**Query params** (validated by `adminProductsSearchSchema` in `features/products/schemas/products.ts`; invalid values fall back to page 1):

| Param | Type | Notes |
|-------|------|-------|
| `page` | int ≥ 1 | default 1 |
| `limit` | int 1–100 | default 20 |
| `search` | string | full-text + `ILIKE` on title/description/seller |
| `productType` | `loose_stone` \| `jewellery` | |
| `categoryId` | uuid | matches direct category or any jewellery-gemstone category |
| `stoneCut`, `metal`, `identification`, `shape`, `origin`, `laboratoryId` | | |
| `createdFrom`, `createdTo` | `YYYY-MM-DD` | inclusive range |
| `sortBy`, `sortOrder` | admin-style column sort | overrides default marketplace ordering |
| `newest` | `true` \| `1` | pure `createdAt desc`, ignored when `search` is set |
| `isFeatured`, `isCollectorPiece`, `isPrivilegeAssist` | `true` \| `false` | |

Only `status: "active"` products are returned; `rejected` moderation status is always excluded.

**Ordering:** marketplace priority (collector piece → privilege assist → featured → newest) unless `sortBy`/`sortOrder` or `newest=true` is given. **Exception:** `isPrivilegeAssist=true` with no `search`/`sortBy`/`sortOrder`/`newest` reshuffles randomly (see caching note below).

**Response 200:**

```json
{
  "products": [
    {
      "id": "...", "sku": "RUBY-...", "title": "...", "description": "...",
      "price": "500", "currency": "USD", "productType": "loose_stone",
      "categoryId": "...", "categoryName": "Ruby", "stoneCut": "Faceted",
      "status": "active", "moderationStatus": "approved",
      "isFeatured": true, "featured_expires_at": "2026-07-01T00:00:00.000Z",
      "isCollectorPiece": false, "isPrivilegeAssist": false, "isVerified": true,
      "sellerId": "...", "sellerName": "...", "sellerPhone": "...",
      "imageUrl": "https://.../first.jpg", "createdAt": "2026-06-01T00:00:00.000Z"
    }
  ],
  "total": 42
}
```

- Collector pieces are masked to `{ id, price: null, maskedPrice, currency, status, imageUrl, isCollectorPiece: true, ... }` in the general browse (`maskCollectorPiece`), unless explicitly filtering `isCollectorPiece=true`/`isFeatured=true`.
- `featured_expires_at` is the DB's `featuredExpiresAt` as ISO 8601 (snake_case on the wire); `isFeatured` is `false` once expired even if the DB flag is still `true`.

### Collector-piece browse (`isCollectorPiece=true`)

Public — no auth required. Every product is masked (`maskCollectorPiece`) unless the requester has a valid session **and** an approved `collector_piece_show_request` for that specific product, in which case that product is returned unmasked. Response is `no-store` when a session is present (personalized), otherwise the shared public cache.

**Errors:**
- `500 {"error": "Failed to fetch products"}` — unexpected error
- `503 {"error": "Products are taking longer than usual to load — please retry"}` with `Retry-After: 3` — the query didn't complete within 6s (see `docs/technical/connection-pool-hardening.md`); safe to retry

**Example:**

```bash
curl "http://localhost:3000/api/products?isFeatured=true&limit=4"
```

**Caching:** `public, s-maxage=60, stale-while-revalidate=300` for every branch, including `isPrivilegeAssist=true` — that branch is served through a short-TTL (`cacheLife({ revalidate: 30, expire: 90 })`) cached wrapper (`getPrivilegeAssistBrowse`) instead of hitting the database on every request, so the "random" order actually reshuffles roughly every 30s (shared across all viewers in that window) rather than on every single request.

## POST /api/products

**Auth:** session required (bearer or cookie)
**Body:** validated by `productCreateSchema` (`features/products/schemas/products.ts`); `sellerId` is taken from the session, not the body.

Creating with `isFeatured: true` and `featured > 0` deducts that many points from the seller's balance (`400` if insufficient).

The server detects the **title** language (English / Myanmar / Thai / Korean) via Google Cloud Translation and translates into the other three locales (`titleEn`, `titleMy`, `titleTh`, `titleKo`). `product.language` is set from the title source language. When `description` is non-empty, the same process fills `descriptionEn/My/Th/Ko`. Requires `GOOGLE_TRANSLATE_API_KEY`. Empty/omitted description skips description translation only.

**Response 201:** `{ "success": true, "productId": "...", "language": "English" }`

**Errors:**
- `400 {"error": "...", "details": {...}}` — validation failure
- `400 {"error": "Insufficient points balance"}`
- `401 {"error": "Unauthorized"}`
- `503 {"error": "Google Translate is not configured…"}` — missing/invalid key (title always requires translation)
- `500 {"error": "Failed to create product"}`

**Example:**

```bash
curl -X POST "http://localhost:3000/api/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "Ruby",
    "price": "100",
    "productType": "loose_stone",
    "categoryId": "00000000-0000-4000-8000-000000000001",
    "weightCarat": "1",
    "color": "red",
    "origin": "Myanmar",
    "description": "Natural ruby from Mogok"
  }'
```

```json
{ "success": true, "productId": "…", "language": "English" }
```

**Mobile flag:** yes, both endpoints back the mobile app's Home tab and product-creation flow.
