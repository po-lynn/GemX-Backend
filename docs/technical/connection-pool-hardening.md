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

## Codebase-wide sweep (Aug 2, 2026)

The same root cause reproduced on `/admin/products` (screen-recorded: the page hung indefinitely on a 3-way `Promise.all` — list + counts + facet counts, the latter firing 2 more queries internally — while every other admin page loaded fine). A follow-up audit found the same anti-pattern (concurrent DB calls via `Promise.all`, no timeout) in 19 more locations. Fixed, in priority order:

**Tier 1 (mobile/public, high traffic):**
- `app/api/products/[id]/route.ts` — product detail (web + mobile's only product-detail source)
- `app/api/profile/[id]/route.ts` — public seller profile
- `app/api/chat/history/route.ts`, `app/api/chat/messages/route.ts` — chat thread + send
- `app/api/chat/unread/preview/route.ts` / `features/chat/db/conversations-list.ts` — unread badge preview
- `app/api/mobile/points/history/route.ts` / `features/points/db/points.ts` (`getUserPointHistory`) — wallet screen

**Tier 2 (frequently-used admin pages):**
- `app/admin/users/page.tsx`, `app/admin/products/[id]/edit/page.tsx` (worst fan-out found: 6-way `Promise.all`), `app/admin/collector-piece-show-requests/page.tsx`
- `app/admin/credit/purchase-requests/page.tsx`, `app/admin/credit/premium-dealer-subscriptions/page.tsx`, `app/admin/credit/transactions/page.tsx`, `app/admin/messages/page.tsx`, `app/admin/news/page.tsx`, `app/admin/articles/page.tsx`

Every admin page above got a matching `error.tsx` boundary (mirroring `app/admin/products/error.tsx`) where none existed at that route segment. Tier 3 (low-traffic settings pages, single-record edit forms) and `getAdminProductFacetCounts`'s internal 2-query `Promise.all` were identified but intentionally left unfixed for now — lower priority, revisit if they become relevant.

### Two timeout helpers, two different jobs

This sweep surfaced a pre-existing, differently-designed helper: `lib/db-timeout.ts` (`withTimeout`/`safeAll`), already used in `app/admin/page.tsx`, which resolves to a **fallback value** on timeout instead of throwing. Rather than standardize on one helper, we split by query role (full rationale and code examples in `docs/guides/connection-pool-and-query-timeouts.md`):

- **Primary** query (the content the screen exists to show) → `lib/query-timeout.ts`'s `withQueryTimeout`, throws → `503`/`error.tsx`. Never fake success on the thing the user is actually waiting for.
- **Secondary** query (decoration alongside already-useful primary content — a rating badge, a tab count, a presence indicator) → `lib/db-timeout.ts`'s `withTimeout`/`safeAll`, degrades to a fallback. The fallback must render as visibly absent/unknown (e.g. `rating: null`, `status: "Unknown"`), never as a bare `0`/empty result indistinguishable from a real one.
- One notable fail-closed exception: `app/api/chat/messages/route.ts`'s recipient-exists and rate-limit checks are gating checks, not enrichment — timing out returns `503` rather than silently letting a send through, since a permissive fallback there would be an abuse-prevention bypass.

### Known follow-ups (not yet fixed)

- `features/points/db/points.ts`'s `getPointTransactionCounts` (used by `app/admin/credit/transactions/page.tsx`) loads every row and aggregates in JS — an unbounded full-table scan independent of the timeout issue; flagged with a `// TODO:` at the call site.
- `app/admin/collector-piece-show-requests/page.tsx`'s KPI tiles render a bare `0` for both "confirmed zero" and "timed out" — the component has no way to distinguish them today; flagged with a `// KNOWN LIMITATION` comment rather than redesigned.
- Tier 3 items from the audit (admin settings pages, single-record edit forms under `app/admin/{news,articles,categories,users}/[id]/edit/page.tsx`) — lower traffic, not fixed in this pass.

## Edge cases & known limitations

- `withQueryTimeout` does not cancel the underlying `postgres.js`/Drizzle query — see above. True cancellation would require using `postgres.js`'s raw `.execute().cancel()` API, which doesn't currently thread through Drizzle's query builder in this codebase.
- The 15-connection pooler ceiling is a Supabase compute-tier property (visible at Project Settings → Database → Connection pooling), not something this change can raise. Upgrading compute tier raises it directly; this change only makes better use of the existing ceiling.
- `getPrivilegeAssistBrowse`'s cache key is derived from its input options — different filter combinations (category, stone cut, etc.) each get their own cached shuffle, all sharing the same invalidation tag.
