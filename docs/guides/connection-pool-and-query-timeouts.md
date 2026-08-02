# Guide: Query Timeouts & Short-TTL Caching on Hot Endpoints

Background: see `docs/technical/connection-pool-hardening.md` for why this exists — Supabase's Micro-tier pooler only hands out 15 real backend connections total, shared across every concurrent Vercel invocation, and there's no `statement_timeout` on that path.

## Prerequisites

- No new env vars or dependencies. Uses the existing `drizzle/db.ts` client and `next/cache`'s `"use cache"` directive (already enabled via `cacheComponents: true` in `next.config.ts`).

## Using `withQueryTimeout` in a new route

```ts
import { withQueryTimeout, QueryTimeoutError } from "@/lib/query-timeout"

export const maxDuration = 10 // Vercel backstop

export async function GET(request: NextRequest) {
  try {
    const result = await withQueryTimeout(
      someDbCall(opts),
      6000,          // ms — leave headroom under maxDuration for auth/session lookups etc.
      "my-query-label" // shows up in the timeout error message and server logs
    )
    return jsonCached(result)
  } catch (error) {
    if (error instanceof QueryTimeoutError) {
      return Response.json(
        { error: "Taking longer than usual — please retry" },
        { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3" } }
      )
    }
    return jsonError("Failed", 500)
  }
}
```

**Important:** this only bounds how long the *client* waits. It does not cancel the in-flight Postgres query. Don't rely on it to protect the database from a runaway query — that still needs the query itself to be fast, or the pool to have headroom.

## Multiple DB calls in one route: sequential, not `Promise.all`

If a route needs two independent DB calls, await them one at a time rather than `Promise.all`-ing them, so the route never holds two pooler connections simultaneously:

```ts
// Prefer this:
const a = await withQueryTimeout(getA(), 6000, "a")
const b = await withQueryTimeout(getB(), 6000, "b")

// Over this (doubles peak connection usage for the request):
const [a, b] = await Promise.all([getA(), getB()])
```

This matches the existing pattern in `getProductById` (`features/products/db/products.ts`) and `app/api/news/route.ts`.

## Adding a short-TTL cache to a hot, rarely-changing query

Use the same pattern as `getPrivilegeAssistBrowse` (`features/products/db/cache/products.ts`) or `getCachedNewsCategoryCounts` (`features/news/db/cache/news.ts`):

```ts
import { cacheTag, cacheLife } from "next/cache"
import { getGlobalTag } from "@/lib/dataCache"
import { getMyDataFromDb } from "../myFeature"

export async function getCachedMyData(opts) {
  "use cache"
  cacheTag(getGlobalTag("myFeature")) // add "myFeature" to the CACHE_TAG union in lib/dataCache.ts first
  cacheLife({ stale: 30, revalidate: 30, expire: 90 })
  return getMyDataFromDb(opts)
}
```

Then wire invalidation into wherever the underlying data mutates:

```ts
import { revalidateTag } from "next/cache"

export function revalidateMyFeatureCache() {
  // Must be revalidateTag(tag, "max"), never updateTag — updateTag throws when called
  // from a Route Handler or non-Server-Action context (see revalidateProductsCache /
  // revalidateNewsCache for the same guard).
  revalidateTag(getGlobalTag("myFeature"), "max")
}
```

Call the `revalidate*Cache()` function immediately after every create/update/delete that touches the cached data.

## Common errors

- **"updateTag can only be called from within a Server Action"** — you called `updateTag` instead of `revalidateTag(tag, "max")` from a Route Handler. Always use `revalidateTag` in shared cache-invalidation helpers so they're safe to call from both Server Actions and Route Handlers.
- **Test hangs / times out at 5000ms** — if you're testing a route that uses `withQueryTimeout` with a multi-second timeout, use `vi.useFakeTimers()` + `await vi.advanceTimersByTimeAsync(ms)` instead of a real delay (see `tests/api/products/route.test.ts` / `tests/api/news.test.ts` for the pattern).
- **Cached data looks stale after a mutation** — confirm the mutation path actually calls the matching `revalidate*Cache()` function. `cacheLife`'s `expire` window is the outer bound if invalidation is missed.
