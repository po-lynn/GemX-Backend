# GET /api/categories — productCount

**Endpoint:** `GET /api/categories`  
**Auth:** Public  
**Mobile flag:** yes (mobile app uses this for category chips / add-product)

## Query

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | Optional. `loose_stone` or `jewellery`. Omit for all. |

## Response 200

Array of category objects. New field:

| Field | Type | Description |
|-------|------|-------------|
| `productCount` | number | Count of products with `categoryId` = this category, `status = active`, and `moderationStatus ≠ rejected` |

```json
[
  {
    "id": "uuid",
    "type": "loose_stone",
    "name": "Sapphire",
    "shortCode": "SP",
    "image": "https://…/category.jpg",
    "slug": "sapphire",
    "sortOrder": 0,
    "productCount": 12,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
]
```

## Example

```bash
curl -s "https://your-host/api/categories?type=loose_stone"
```

## Errors

- `500` — `{ "error": "Failed to fetch categories" }`
