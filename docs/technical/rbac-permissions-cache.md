# RBAC Permissions Cache Fix

## What changed

`features/rbac/db/permissions.ts` — `getUserPermissions(userId)` and
`setUserPermissions(userId, perms)`.

**Bug:** an admin could toggle any feature permission on/off for an internal
user (e.g. Messages, Products, Point Packages — every entry in
`FEATURE_GROUPS`), save, and the change would never actually take effect —
not on that save, not on any later save. Reported symptom: granting the
"Messages" permission to an internal user, saving, and the user's `/admin`
sidebar still not showing the Messages link.

**Root cause:** `getUserPermissions()` was cached with the legacy
`unstable_cache(fn, [tag], { tags: [tag] })` API:

```ts
return unstable_cache(
  async () => { /* db query */ },
  [permCacheTag(userId)],
  { tags: [permCacheTag(userId)] }
)()
```

and invalidated via `revalidateTag(permCacheTag(userId), "default")` in
`setUserPermissions()`. This project has `cacheComponents: true` in
`next.config.ts` (Next 16's newer caching model). Every *other* cached read
in the codebase already uses the `"use cache"` directive + `cacheTag()`
instead of `unstable_cache` — `getCachedProduct`/`getAdminProducts`/etc. in
`features/products/db/cache/products.ts`, `getCachedNewsCategoryCounts` in
`features/news/db/cache/news.ts` — each paired with a `revalidateTag(tag,
"max")` write-side call, with an explicit comment on the products cache
(`revalidateProductsCache`) that the profile argument matters and
`updateTag` throws outside Server Actions. `unstable_cache` entries don't
participate in that tag/profile invalidation model the same way, so the
`revalidateTag` call on save was effectively a no-op against them: the first
computed permissions snapshot for a given user — often computed before they
were ever granted anything — stayed cached indefinitely no matter how many
times an admin edited and saved that user's permissions afterward.

**Why this was easy to miss:** the very first read for a brand-new internal
user (before any permissions exist) returns `{}` regardless of caching, so
testing "does saving permissions work at all" right after creating a user
can appear to succeed by coincidence. The bug only reliably reproduces once
a user's permissions have already been read-and-cached once, then changed
later — exactly the "I gave permission and it's still not working" report
that surfaced this.

**Fix:**
- `getUserPermissions()` now uses `"use cache"` + `cacheTag()`, matching the
  rest of the codebase, instead of `unstable_cache`.
- `lib/dataCache.ts` — added `"internalPermission"` to the `CACHE_TAG` union
  so the tag is built with the shared `getIdTag()` helper instead of a
  hand-rolled template string.
- `setUserPermissions()`'s two `revalidateTag()` calls switched from the
  `"default"` profile to `"max"`, matching `revalidateProductsCache`/
  `revalidateNewsCache`.
- `checkInternalAccess()` is unchanged — it just reads through
  `getUserPermissions()`.

## Data flow

```
saveUserPermissionsAction (features/rbac/actions/permissions.ts)
        │
        ▼
setUserPermissions(userId, perms)          upserts internalPermission rows,
        │                                   then revalidateTag(getIdTag("internalPermission", userId), "max")
        ▼
getUserPermissions(userId)                 "use cache" + cacheTag(same tag) — now actually
        │                                   busted by the write above, so the next
        │                                   call re-queries the DB instead of serving
        │                                   the stale snapshot
        ▼
checkInternalAccess(userId, featureKey)    reads the now-fresh permissions record
        │
        ▼
app/admin/layout.tsx (sidebar), requireFeatureAccess, requireAdminOrFeature,
requireMessagesAccess, requireAdminOrAnyFeature — every access-control call
site downstream now sees permission changes immediately after save.
```

## Schema impact

None. No Drizzle schema or migration changes — this is purely a caching-layer
fix over the existing `internalPermission` table.

## Auth & permissions

No guard/authorization logic changed — every `require*` helper and
`checkInternalAccess()` call site keeps its existing semantics. This fixes
*when* a saved permission change becomes visible (immediately, instead of
never), not *who* is allowed to do what.

## Known gaps / limitations

- This was traced and fixed via the Messages/Chat Dashboard permission merge
  ([[messages-triage|Messages Triage Inbox doc]], Phase 4) since that's what
  surfaced it, but the bug affected **every** feature key in `FEATURE_GROUPS`
  equally — it was never specific to Messages.
- No regression test exercises the actual `"use cache"` caching/invalidation
  behavior end-to-end (that requires Next's build pipeline, not achievable
  in Vitest) — `tests/unit/rbac-permissions.test.ts` covers the read/write
  logic and asserts `revalidateTag` is called with the `"max"` profile and a
  per-user tag, mirroring how `tests/unit/products-cache-revalidate.test.ts`
  covers the equivalent products cache without executing the real Next cache
  runtime.
