# Product Verified Badge — API Reference

## Endpoint

**GET** `/api/products/:id`

**Auth:** Not required (optional; presence of a valid Bearer token affects collector-piece access).

## New field: `isVerified`

| Field        | Type    | Description |
| ------------ | ------- | ----------- |
| `isVerified` | boolean | `true` when a staff member has verified the product listing (GemX Verified Badge). `false` otherwise. |

`isVerified` is present on both the list response (`GET /api/products`) and the single-product detail response (`GET /api/products/:id`).

The internal field `verifiedBy` (the staff user ID who performed the verification) is **stripped** before the response is sent. It is never included in any public or mobile response.

## Example response fragment

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Unheated Blue Sapphire",
  "isVerified": true,
  "isFeatured": false,
  "isCollectorPiece": false,
  "seller": { "id": "...", "name": "Seller Name", "rating": { "averageScore": 4.8, "totalRatings": 7 } }
}
```

## Security note

`verifiedBy` is stripped in `app/api/products/[id]/route.ts` alongside `changeLog` to prevent internal staff identity disclosure:

```typescript
const { changeLog: _adminChangeLog, verifiedBy: _verifiedBy, ...publicProduct } = product
```

## Mobile API

This field is consumed by the mobile app via the public product endpoints. See `docs/MOBILE-API.md` §5.1 (list) and §5.2 (single product) for the full response shapes.
