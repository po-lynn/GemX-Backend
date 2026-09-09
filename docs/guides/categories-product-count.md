# Guide: Category productCount

## Prerequisites

None beyond existing DB schema (`product.category_id`, `product.status`, `product.moderation_status`).

## How to use

```bash
curl -s "http://localhost:3000/api/categories"
```

Each item includes `productCount` for badges/chips:

```ts
const res = await fetch("/api/categories?type=loose_stone")
const cats = await res.json() as Array<{ id: string; name: string; productCount: number }>
cats.forEach((c) => console.log(`${c.name}: ${c.productCount}`))
```

## How to extend

To change which products count (e.g. include drafts), edit the join in `features/categories/db/categories.ts` (`activeListingJoin`). Keep it in sync with public `GET /api/products` filters if the count is for buyers.

## Common errors

| Symptom | Cause | Fix |
|---------|--------|-----|
| Always `0` | Products are draft or rejected | Only `active` + non-`rejected` count |
| Admin page type error | Stale `CategoryRow` mock without `productCount` | Add `productCount: 0` to fixtures |
