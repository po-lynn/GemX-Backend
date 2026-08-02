# Connection Pool & Query Timeout Hardening

## What changed

The mobile app's Home tab and News tab could get stuck in a perpetual loading state (infinite spinner, blank screen) requiring a full app relaunch to recover. Root cause: Supabase's Micro-tier pooler multiplexes down to a small, fixed number of real backend connections (Settings → Database → Connection pooling → "Pool Size", 15 on Micro, shared across every concurrent Vercel invocation project-wide), and this codebase had no `statement_timeout` on that connection path (PgBouncer transaction mode silently ignores session-level `SET`) and no application-level timeout either. A burst of concurrent requests — even from a handful of real users, since a single mobile screen load fires 6-10 parallel API calls — could exceed the 15-connection ceiling; any request then queued indefinitely with no ceiling on the wait, and the mobile client had no way to recover except a full relaunch.

**Files touched:**
- `drizzle/db.ts` — lowered the per-instance pooler connection cap and idle timeout
- `lib/query-timeout.ts` (new) — `withQueryTimeout` / `QueryTimeoutError`
- `app/api/products/route.ts` — timeout-wrapped DB calls, `maxDuration`, 503 on timeout
- `app/api/news/route.ts` — timeout-wrapped DB calls (sequential, not `Promise.all`), `maxDuration`, 503 on timeout
- `features/products/db/cache/products.ts` — new `getPrivilegeAssistBrowse` cached wrapper
- `features/news/db/cache/news.ts` (new) — `getCachedNewsCategoryCounts`, `revalidateNewsCache`
- `features/news/actions/news.ts` — wired `revalidateNewsCache()` into create/update/delete
- `lib/dataCache.ts` — added `"news"` to the `CACHE_TAG` union

## Data flow

**Before:** every Home-tab load → `GET /api/products?isPrivilegeAssist=true` → uncached, `ORDER BY random()` straight to Postgres, every single request. Every `GET /api/news` → `Promise.all([list, categoryCounts])`, two concurrent pooler connections per request, `categoryCounts` re-running an unindexed `GROUP BY` every time.

**After:**
```
GET /api/products?isPrivilegeAssist=true (no search/sort/newest)
  → withQueryTimeout(getPrivilegeAssistBrowse(opts), 6000ms)
      → "use cache", cacheLife({ revalidate: 30, expire: 90 })
          → getAdminProductsFromDb({ ...opts, isPrivilegeAssist: true, random: true })
  → jsonCached (safe now: the shuffle itself only refreshes every ~30s)

GET /api/news
  → withQueryTimeout(getNewsPaginatedFromDb(...), 6000ms)   ← sequential
  → withQueryTimeout(getCachedNewsCategoryCounts(), 6000ms)  ← sequential, cached 30s
  → jsonCached
```
Any product create/update busts `getPrivilegeAssistBrowse` via the existing `revalidateProductsCache()` (same global `"products"` tag). Any news create/update/delete busts `getCachedNewsCategoryCounts` via the new `revalidateNewsCache()`.

## Schema impact

None. No Drizzle schema changes, no migration.

## Auth & permissions

No change — both routes remain public, unauthenticated GETs.

## Key decisions

- **`drizzle/db.ts`**: pooler `max` dropped from 10 to 4 per instance, `idle_timeout` from 20s to 10s. This bounds how much of the shared 15-connection ceiling any single Vercel instance can claim; it does not raise the ceiling itself.
- **`withQueryTimeout`** (`lib/query-timeout.ts`) is a `Promise.race` against a timer — it bounds *client-facing* wait time (6s per query, `maxDuration = 10` on the route as a platform-level backstop) but does **not** cancel the underlying Postgres query. A timed-out call can still hold its connection until the query finishes or the pooler drops it. This is a client-experience fix, not a substitute for keeping query volume and pool size low.
- **Sequential over `Promise.all`** in `app/api/news/route.ts`: matches the existing precedent in `getProductById` ("Sequential queries for Supabase compatibility") — one connection in flight at a time per request instead of two, trading a small amount of latency for lower peak concurrent connection usage.
- **Privilege Assist caching** changes product behavior: the random shuffle now refreshes every ~30s (shared across all viewers within that window) instead of reshuffling on every single request. Deliberate tradeoff to cut DB round-trips on the hottest mobile path.
- **News category counts caching**: `getNewsCategoryCountsFromDb` runs an unindexed `GROUP BY` on `news.category` (no index exists on that column) — caching it means the mobile category chip counts can lag up to ~90s behind a very recent publish/unpublish, self-healing via `cacheLife`'s `expire` window and immediately on `revalidateNewsCache()`.

## Edge cases & known limitations

- `withQueryTimeout` does not cancel the underlying `postgres.js`/Drizzle query — see above. True cancellation would require using `postgres.js`'s raw `.execute().cancel()` API, which doesn't currently thread through Drizzle's query builder in this codebase.
- The 15-connection pooler ceiling is a Supabase compute-tier property (visible at Project Settings → Database → Connection pooling), not something this change can raise. Upgrading compute tier raises it directly; this change only makes better use of the existing ceiling.
- `getPrivilegeAssistBrowse`'s cache key is derived from its input options — different filter combinations (category, stone cut, etc.) each get their own cached shuffle, all sharing the same invalidation tag.
