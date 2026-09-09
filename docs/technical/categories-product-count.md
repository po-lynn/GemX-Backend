# Categories API — productCount

## What changed

`GET /api/categories` (and the underlying `getAllCategories` / `getCategoriesByType` / `getCategoryById` helpers) now return **`productCount`** per category.

### Files

| Path | Change |
|------|--------|
| `features/categories/db/categories.ts` | Left-join `product` + `count(*)`; extend `CategoryRow` |
| `app/api/categories/route.ts` | Unchanged handler — response shape comes from DB helpers |
| `tests/api/categories.test.ts` | Assert `productCount` passthrough |
| `tests/unit/categories-product-count.test.ts` | Query helper coverage |
| `docs/MOBILE-API.md` §4.1 | Document field |
| `docs/api/categories.md` | Route reference |

## Data flow

```
GET /api/categories[?type=]
  → getCategoriesByType | getAllCategories
  → SELECT category.*, count(product.id)
       FROM category
       LEFT JOIN product
         ON product.category_id = category.id
        AND product.status = 'active'
        AND product.moderation_status <> 'rejected'
       GROUP BY category.*
  → jsonCached([...{ productCount }])
```

## Schema impact

None (read-only aggregate).

## Auth & permissions

Public (unchanged).

## Edge cases

- Categories with no matching listings return `productCount: 0`.
- Draft / sold / archived / rejected products are **not** counted (aligned with public product list).
- Admin category UI receives the extra field harmlessly; it can ignore `productCount`.
