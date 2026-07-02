# Fix: POST /api/products returned 500 "Failed to create product" (updateTag in Route Handler)

**Date:** 2026-07-02

## What changed

- `features/products/db/cache/products.ts` — `revalidateProductsCache()` now calls
  `revalidateTag(tag, "max")` instead of `updateTag(tag)`.
- `tests/unit/products-cache-revalidate.test.ts` — new regression test.

## Root cause

In Next.js 16, `updateTag` from `next/cache` may only be called from within a
**Server Action**. Calling it from a **Route Handler** throws:

```
Error: updateTag can only be called from within a Server Action.
To invalidate cache tags in Route Handlers or other contexts, use revalidateTag instead.
```

(See `node_modules/next/dist/server/web/spec-extension/revalidate.js` — it throws when
`workStore.page.endsWith('/route')`.)

`revalidateProductsCache()` is shared by **both** contexts:

| Caller | Context |
|--------|---------|
| `features/products/actions/products.ts`, `portal-products.ts` | Server Actions (updateTag legal) |
| `app/api/products/route.ts` (POST) | Route Handler (updateTag throws) |
| `app/api/products/[id]/route.ts` (PATCH/DELETE) | Route Handler (updateTag throws) |
| `app/api/mobile/products/[id]/feature/route.ts` (POST) | Route Handler (updateTag throws) |

During the Jun 26 caching refactor the helper was switched from
`revalidateTag(tag, "max")` to `updateTag(tag)`, which silently broke every
route-handler caller.

## Failure mode (why it looked like "create failed" but rows appeared)

`POST /api/products` flow:

1. auth ✓ → 2. Zod validation ✓ → 3. `createProductInDb()` ✓ (product + media rows
   inserted) → 4. `revalidateProductsCache(productId)` **throws** → 5. `catch` returns
   **500 `{ "error": "Failed to create product" }`**.

The product **was created** but the client got a 500. Mobile retries produced
duplicate products (7 test products created on 2026-07-02 in production by user
`VAHvEEbtHaMmb95rkhWFgwtgNbY04tu3` — consider cleaning them up).

The same post-mutation 500 affected PATCH/DELETE `/api/products/:id` and
POST `/api/mobile/products/:id/feature` (points were deducted, then 500 returned).

## Fix

`revalidateTag(tag, "max")` is legal in both Server Actions and Route Handlers and
uses immediate expiration (the `"max"` profile), matching the previous behavior.
Without a second argument `revalidateTag` logs a deprecation warning, so `"max"` is
required.

## Data flow

Mutation (action or route) → `revalidateProductsCache(id?)` →
`revalidateTag(product:global, "max")` + `revalidateTag(product:<id>, "max")` →
`"use cache"` wrappers (`getCachedProduct`, `getAdminProducts`, …) tagged via
`cacheTag()` refetch on next read.

## Schema impact

None.

## Auth & permissions

Unchanged. POST /api/products still requires a session (cookie or bearer).

## Other cache helpers audited

`features/{origin,laboratory,rating-tags,precaution-tags}/db/cache/*.ts` also use
`updateTag`, but are **only** called from Server Actions today, so they were left
unchanged. If any of them is ever called from a Route Handler it must switch to
`revalidateTag(tag, "max")` too.

## Edge cases & known limitations

- The runtime guard (`updateTag` throwing outside actions) cannot be reproduced in
  vitest; the regression test enforces the API choice by mocking `next/cache` with a
  throwing `updateTag`.
- Unrelated: mobile payloads send `additional_memos` (snake_case); the schema only
  accepts `additionalMemos`, so the value is silently dropped. Not fixed here.
