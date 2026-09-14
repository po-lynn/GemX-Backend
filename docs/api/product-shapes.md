# GET /api/product-shapes

**Auth:** Public — no session required.

**Mobile flag:** Yes — product create/edit shape dropdown and filters.

**Request:** No params.

**Response (200):** Array of product shapes, ordered by `name` ascending.

```json
[
  { "id": "uuid", "name": "Oval", "createdAt": "2026-09-14T00:00:00.000Z", "updatedAt": "2026-09-14T00:00:00.000Z" },
  { "id": "uuid", "name": "Round", "createdAt": "2026-09-14T00:00:00.000Z", "updatedAt": "2026-09-14T00:00:00.000Z" }
]
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Product shape UUID |
| `name` | string | Display name (e.g. Oval, Round) |
| `createdAt` | string | ISO timestamp |
| `updatedAt` | string | ISO timestamp |

**Caching:** Same pattern as `GET /api/origins`: `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.

**Errors:** `500` → `{ "error": "Failed to fetch product shapes" }`.

**Example:**

```bash
curl https://gemx.app/api/product-shapes
```

**Admin CRUD:** Managed at **Admin → Master Data → Configuration → Product Shape** (`/admin/product-shape`). Mutations use server actions (admin role only), not this public route.
