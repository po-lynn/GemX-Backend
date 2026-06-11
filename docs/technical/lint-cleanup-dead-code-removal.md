# Lint Cleanup — Dead Code Removal After Fallow De-export Pass

**Date:** 2026-06-11

## What changed and why

The fallow auto-fix pass earlier today removed the `export` keyword from 79 unused
exports. That left ~50 now-unreferenced local declarations behind, which surfaced as
67 ESLint problems (1 error, 66 warnings). This change deletes that dead code rather
than silencing the warnings. ESLint and `tsc --noEmit` are now both clean.

Every deleted symbol was verified to have **zero references outside its defining
file** (repo-wide `grep -w` across `app/`, `components/`, `features/`, `lib/`,
`hooks/`, `tests/`, `scripts/`, `drizzle/`) before removal.

### Error fixed

- `lib/phone.ts` — `let p` → `const p` (`prefer-const`).

### Dead declarations deleted (previously de-exported by fallow)

| File | Removed |
|------|---------|
| `components/admin/admin-ui.tsx` | `adminTHCenter`, `adminTR`, `adminTDMuted`, `adminInput`, `adminSelect`, `adminTextarea`, `adminLabel`, `adminFieldClass`, `AdminPageHeader` |
| `features/articles/db/articles.ts` | `getAllArticlesFromDb`, `getArticleBySlug`, unused `ne` import |
| `features/news/db/news.ts` | `getAllNewsFromDb` |
| `features/notifications/db/user-devices.ts` | `touchUserDevice`, `getUserDevicesForUser`, `mapRow`, unused `UserDeviceRecord` type import |
| `features/points/actions/points.ts` | 11 unexported server actions: `get{DefaultRegistrationPoints,EarningPointsRates,PointManagementSettings,FeatureSettings,PremiumDealersSettings}Action`, `save{PremiumDealersSettings,FeatureSettings,PointManagementSettings,PointPurchasePackagesSettings}Action`, `setUserPointsAction`, `adminAdjustUserPointsAction` (+ now-unused db imports) |
| `features/points/db/points.ts` | `getEarningPointsRate`, `getUserPremiumDealerStatus` |
| `features/products/actions/products.ts` | `setProductModeration`, `setProductStatus`, `setProductFeatured` (+ their action schemas and `productAdminChangeLog` imports) |
| `features/push/db/push-tokens.ts` | deprecated wrappers `upsertPushToken`, `removePushToken`, `getAllPushTokens`; only `getPushTokensByUserIds` remains |
| `features/push/send-push.ts` | `sendPushToMobileUsers` |
| `features/*/permissions/{laboratory,origin,products,users}.ts` | unused `*Permissions` constant objects (the `canAdminManage*` functions remain) |
| `lib/dataCache.ts` | `getUserTag` |
| `lib/supabase/browser.ts` | `isSupabaseBrowserConfigured`, `resetSupabaseBrowserClient` |
| `features/products/schemas/gemstone-spec.ts` | `GEMSTONE_SPEC_FIELD_NAMES` const replaced with a direct `GemstoneSpecFieldName` union type (it was only used in type position) |

### Orphaned component files deleted

These components lost their export in the fallow pass, are not referenced by any
barrel (`index.ts`) or page, and were therefore entirely dead:

- `components/admin/list-view/BulkActionBar.tsx`
- `features/laboratory/components/LaboratoryTable.tsx`
- `features/origin/components/OriginTable.tsx`
- `features/rating-tags/components/RatingTagsTable.tsx`
- `features/users/components/UserFilters.tsx`
- `features/products/components/FormActionBar.tsx`

The superseding list-view system (`ListViewCard`) and per-feature `*ListView`
components remain.

### Unused imports removed

- `features/chat/components/ChatDashboard.tsx` — `normalizeChatMessageRow`
- `features/points/components/AdminCreditPointsForm.tsx` — `User` (lucide)
- `features/points/components/UserPointTransactionTable.tsx` — `Clock` (lucide)
- `features/points/components/PurchaseForm.tsx` — local `getPrice` helper
- `features/users/components/UserForm.tsx` — `AdminFormSection`, local `selectClass`
- `scripts/backfill-point-transactions.ts` — `user`, `eq`, `inArray`
- `tests/api/admin/push-global.test.ts`, `tests/api/push/global-subscribe.test.ts` — `connection`
- `public/firebase-messaging-sw.js` — stale `eslint-disable no-undef` directive

### Suppressions (intentional `<img>` usage)

`features/users/components/UserForm.tsx` keeps four `<img>` elements for avatar
upload previews — `imageUrl` can be a local blob/object URL, which `next/image`
does not support. Each has an inline
`eslint-disable-next-line @next/next/no-img-element` with the reason.

## Type fix: `lib/api-guard.ts` GuardResult narrowing

`GuardResult` used optional-`never` markers
(`{ session: …; error?: never } | { error: Response; session?: never }`), which
defeats `"error" in gate` narrowing — `gate.error` stayed `Response | undefined`,
making every guarded route handler's return type `Response | undefined` and
producing 4 `tsc` errors in `tests/api/admin/push-global.test.ts`. The markers were
removed so the union is discriminated by property presence; all 8 call sites use
`if ("error" in gate) return gate.error` and now narrow correctly. No runtime change.

## Data flow / schema impact

None. No Drizzle schema, route behavior, or client contract changed — only dead
code was removed and one TypeScript-only type was tightened.

## Auth & permissions

Unchanged. Deleted server actions were unreachable (not exported); the remaining
exported actions keep their `requireActionRole` guards.

## Verification

- `npx eslint .` — **0 problems** (was 1 error, 66 warnings)
- `npx tsc --noEmit` — **0 errors** (was 4, pre-existing from the guard refactor)
- `npm run test` — **216/216 tests pass**; 3 suites (`tests/api/profile.test.ts`,
  `tests/api/mobile/collector-piece-show-requests.test.ts`,
  `tests/api/products/route.test.ts`) fail at import with `DATABASE_URL is missing`
  — confirmed pre-existing by reproducing on a stashed tree (env issue, unrelated)

## Edge cases & known limitations

- `AdminFormSection` in `admin-ui.tsx` is still exported but now has fewer
  consumers; fallow may flag it in a future pass.
- The deleted deprecated push-token wrappers (`upsertPushToken` etc.) existed for a
  migration to `features/notifications/db/user-devices`; that migration is complete.
- If a future feature needs single-currency earning rates, derive from
  `getEarningPointsRates()` (the per-currency wrapper was removed).
