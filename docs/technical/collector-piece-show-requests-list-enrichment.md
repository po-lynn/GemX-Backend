# Collector piece show requests — GET list fields

## What changed

- `features/collector-piece-show-requests/db/collector-piece-show-requests.ts` — added `getMyCollectorPieceShowRequestsPaginated()` (joins `product` and aliased `user` as seller).
- `app/api/mobile/collector-piece-show-requests/route.ts` — GET handler calls the new helper.
- `docs/MOBILE-API.md` — section **5.4.4** GET.

## Data flow

`collector_piece_show_request` → inner join `product` on `product_id` → inner join `user` (alias `collector_piece_show_req_seller`) on `product.seller_id` → select `product.title` as **`productName`**, seller `user.name` as **`sellerName`**.

## Schema impact

None.

## Auth & permissions

Bearer required; rows filtered by `collector_piece_show_request.user_id = session.user.id`.

## Edge cases

- Requests whose product row is missing would be excluded by `innerJoin` (normally impossible while FK exists; if product is deleted, the request row is cascade-deleted per schema).
