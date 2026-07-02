# Guide: Invalidating the products cache (and cache tags in general)

## Prerequisites

Nothing extra — `next/cache` ships with Next.js 16.

## TL;DR rule

| You are in… | Use |
|-------------|-----|
| Server Action (`"use server"`) | `updateTag(tag)` **or** `revalidateTag(tag, "max")` |
| Route Handler (`app/api/**/route.ts`) | `revalidateTag(tag, "max")` **only** |

`updateTag` throws in Route Handlers:
`Error: updateTag can only be called from within a Server Action.`
Because our `revalidate*Cache()` helpers are shared by both contexts, **always write
them with `revalidateTag(tag, "max")`**.

## How to invalidate product caches

```ts
import { revalidateProductsCache } from "@/features/products/db/cache/products"

// after any product mutation (create/update/delete/feature):
revalidateProductsCache(productId) // per-product + global list tag
revalidateProductsCache()          // global list tag only
```

Reads go through the `"use cache"` wrappers in the same file (`getCachedProduct`,
`getAdminProducts`, `getPortalProductCounts`, …), which are tagged with `cacheTag()`
and refetch after invalidation.

## How to extend (add a cached read for a new feature)

1. In `features/<name>/db/cache/<name>.ts`:
   ```ts
   import { cacheTag, revalidateTag } from "next/cache"
   import { getGlobalTag, getIdTag } from "@/lib/dataCache"

   export async function getCachedThing(id: string) {
     "use cache"
     cacheTag(getIdTag("things", id))
     return getThingById(id)
   }

   export function revalidateThingCache(id?: string) {
     revalidateTag(getGlobalTag("things"), "max")
     if (id) revalidateTag(getIdTag("things", id), "max")
   }
   ```
2. Call `revalidateThingCache()` after every mutation — in server actions **and**
   route handlers alike. Because it uses `revalidateTag`, it is safe in both.

## Common errors and fixes

- **`updateTag can only be called from within a Server Action`** (500 from an API
  route, often *after* the DB write already succeeded — clients see failure but the
  row exists): a `revalidate*Cache()` helper uses `updateTag` and is being called
  from a route handler. Switch it to `revalidateTag(tag, "max")`.
- **`"revalidateTag" without the second argument is now deprecated` warning:** pass
  `"max"` as the second argument.
- **Stale admin UI after mutation:** make sure the mutation actually calls the
  feature's `revalidate*Cache()` helper with the record id.

## Regression test

`tests/unit/products-cache-revalidate.test.ts` mocks `next/cache` with a throwing
`updateTag` (mirroring route-handler runtime) and asserts
`revalidateProductsCache()` only uses `revalidateTag(tag, "max")`.
