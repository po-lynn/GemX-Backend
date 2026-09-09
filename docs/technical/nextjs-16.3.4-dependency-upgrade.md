# Next.js 16.1.6 → 16.3.4 dependency upgrade

## What changed

Upgraded `next` and `eslint-config-next` from `16.1.6` to `16.3.4` (kept in lockstep,
since `eslint-config-next` must match the `next` minor/patch it lints for). React
(`react`/`react-dom`) was bumped within the same major, `19.2.3` → `19.2.8`, since it's
pinned to an exact version rather than a caret range. All other caret-ranged
dependencies were brought up to the latest version their existing range allows via
`npm update` (no `package.json` range changes needed there — e.g. `@supabase/supabase-js`
2.98.0 → 2.116.0, `better-auth` 1.4.18 → 1.7.3, `drizzle-orm`/`drizzle-kit` patch bumps,
`tailwindcss`/`@tailwindcss/postcss` 4.1.18 → 4.3.3, etc.). Packages that would require a
major-version jump (`@mantine/*` 8→9, `@blocknote/*` 0.46→0.54, `firebase`/`firebase-admin`,
`lucide-react` 0→1, `react-day-picker` 9→10, `vitest` 3→5, `typescript` 5→7) were
deliberately left untouched — each needs its own migration review.

Files touched:
- `package.json`, `package-lock.json` — version bumps described above.
- `patches/drizzle-kit+0.31.8.patch` → `patches/drizzle-kit+0.31.10.patch` — the existing
  `patch-package` patch (guards against a non-string `constraint_definition` during
  Postgres introspection) no longer applied cleanly after the `drizzle-kit` 0.31.8 → 0.31.10
  bump because the patched line shifted by ~30 lines in `api.js`/`api.mjs`/`bin.cjs`. The
  patch was regenerated against 0.31.10 with the identical one-line fix.

### Lint fallout: `react-hooks/set-state-in-effect`

`eslint-config-next@16.3.4` depends on `eslint-plugin-react-hooks@^7.0.0`, and the `npm update`
step resolved that up to `7.1.1`, which ships a new rule (`react-hooks/set-state-in-effect`)
that flags any state setter called synchronously in an effect body. This turned up 29
real (pre-existing, not new) instances of the "reset local state to mirror a prop/value"
anti-pattern across 11 files, which previously lint-passed silently. Each was rewritten
using React's documented ["adjust state during rendering"](https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
pattern instead of an effect:

```tsx
// Before
useEffect(() => { setDate(parseDateValue(value)) }, [value])

// After
const [prevValue, setPrevValue] = useState(value)
if (value !== prevValue) {
  setPrevValue(value)
  setDate(parseDateValue(value))
}
```

For effects that call an async loader on mount/dependency-change (`useEffect(() => { load() }, [load])`,
where `load` itself calls a setter synchronously before its first `await`), the fix instead
defers the call with `queueMicrotask` so the setter isn't invoked synchronously within the
effect body:

```tsx
useEffect(() => { queueMicrotask(load) }, [load])
```

One case (`ProductForm.tsx`'s feature-tier auto-fill-expiry-date effect) genuinely needed to
stay a `useEffect` rather than move to render-time, because it calls `Date.now()` — an impure
function — which a separate rule (`react-hooks/purity`) disallows during render. That one kept
its `useRef`-based mount-skip guard and only deferred the final `setState` via `queueMicrotask`.

Files with behavior-preserving rewrites (no functional change — same effect trigger
conditions, same resulting state):
- `components/admin/list-view/ListViewCard.tsx` — `PriceField`'s text-from-value resync
- `components/date-picker/date-picker.tsx` — `DatePicker`'s date-from-value resync
- `features/articles/components/ArticleForm.tsx`, `features/news/components/NewsForm.tsx` —
  clearing `dirty` on autosave-state transition
- `features/chat/components/ChatDashboard.tsx` — 6 sites: unread-count refresh on mount,
  conversation-list/session-activity rebuild on `users` change, unread-divider reset on
  conversation switch, initial-peer selection, and history load on mount
- `features/messages/components/triage/MessagesTriagePage.tsx` — composer reset on
  conversation switch, thread fetch on mount
- `features/points/components/ActivatePremiumDealerDialog.tsx`,
  `features/points/components/AdminCreatePurchaseRequestDialog.tsx` — debounced user-search reset
- `features/points/components/SurpriseBonusJobsPanel.tsx` — job list load on mount
- `features/products/components/ProductForm.tsx` — 10 sites: seller-picker dialog reset,
  search-dropdown close, and the per-field resets that reinitialize the form when navigating
  to a different product (descriptions/titles, dimensions, moderation status, image/video
  URLs, cert report URL, featured/collector/privilege-assist flags, featured-expiry date,
  and the tier auto-fill effect)
- `features/users/components/UserForm.tsx` — `verified`/`archived` toggle resync when the
  `user` prop changes (e.g. after a save + server refresh)

## Auth & permissions

No change — this is a dependency/tooling upgrade plus a mechanical lint-driven refactor.
None of the touched components' auth or permission logic changed.

## Edge cases & known limitations

- **Update:** the pre-existing `next build` TypeScript failures described below (present
  before this upgrade, unrelated to it) have since been fixed by backfilling the stale test
  fixtures and mock casts — see "Test fixture type drift fix" below. `next build`'s
  TypeScript pass is now fully clean.
- Pre-existing, unrelated to this upgrade: 16 failing tests across 9 files (surprise-bonus
  admin/cron tests tied to in-progress work; `article-form-type`, `product-localize-description`,
  `resolve-adjacent-products`, `notify-monthly-bonus` — none import `next` or touch any
  upgraded package).
- The multi-dependency render-time checks (e.g. `ProductForm.tsx`'s per-field product resets)
  compare each original effect dependency individually (or via a joined string key for
  scalar-only dependency lists) to preserve exact re-trigger semantics — array/object
  dependencies are compared by reference, matching `useEffect`'s own `Object.is` comparison,
  rather than collapsed into a derived boolean that could miss a same-outcome-different-value
  transition.

## Test fixture type drift fix (follow-up)

The ~15 files' worth of pre-existing `next build` TypeScript failures (noted above as a
known limitation before this fix) were all stale test fixtures/mocks, not real bugs — the
underlying `ArticleRow`, `NewsRow`, `ProductForEdit`, `UserForEdit`, and
`EscrowServiceChatData` types had grown new required fields over time that the older test
fixtures never picked up, plus a couple of unrelated Drizzle-mock and `next`-metadata typing
issues. Fixed by:

- Backfilling missing fields on fixture objects (verified against each type's real
  definition, using schema defaults where sensible — e.g. `language: "English"`,
  `type: "article"`):
  - `ArticleRow` fixtures (added `language`, `titleEn/My/Th/Ko`, `contentEn/My/Th/Ko`,
    `type`): `tests/api/article-metadata.test.ts`, `tests/api/articles.test.ts`,
    `tests/component/article-share-card.test.tsx`,
    `tests/component/article-share-card-no-server-url.test.tsx`,
    `tests/unit/article-auto-save-action.test.ts`,
    `tests/unit/article-publish-notification.test.ts`
  - `NewsRow` fixtures (same locale fields, no `type`): `tests/api/news-metadata.test.ts`,
    `tests/component/news-share-card.test.tsx`,
    `tests/component/news-share-card-no-server-url.test.tsx`
  - `EscrowServiceChatData` (added `serviceFee`, `serviceOverview`):
    `tests/api/mobile/escrow-chat-user.test.ts`
  - `ProductForEdit` (added `titleEn/My/Th/Ko`): `tests/api/product-page-metadata.test.ts`
  - `UserForEdit` (added `nrcFrontUrl`, `nrcBackUrl`, `selfieUrl`, `businessLicenseUrl`):
    `tests/api/profile.test.ts`
- `metadata.twitter?.card` accesses (`Twitter` is a discriminated union whose base
  `TwitterMetadata` member doesn't carry `card` — this was already true before the Next.js
  upgrade, just newly caught): changed to
  `(metadata.twitter as { card?: string } | undefined)?.card` in the three metadata test
  files above that assert on it.
- `db.limit` accessed directly on the mocked `db` object (real `PostgresJsDatabase` only
  exposes `.limit()` on the query-builder chain returned by `.select().from()`, not on `db`
  itself) in `tests/integration/phone-login.test.ts` and `tests/unit/phone-login.test.ts`:
  the dynamic `import("@/drizzle/db")` result is now cast through a local
  `MockedPhoneLoginDb` type matching the mock factory's actual shape.
- `as ReturnType<typeof db.select | .update | .insert>` casts in
  `tests/unit/products-facet-counts.test.ts` and `tests/unit/products-verify-db.test.ts`
  routed through `unknown` first (`as unknown as ReturnType<...>`), since the hand-rolled
  mock chain objects don't structurally overlap enough with Drizzle's real builder classes
  for TypeScript to allow the direct cast — no behavior change, purely a type-level fix.

No production code changed in this follow-up — every fix is in `tests/`. Confirmed via
`npm run build` (TypeScript pass now clean) and `npm run test` (same 1039 passing / 16
pre-existing unrelated failures as before, so nothing shifted).

## Cache Components (`instant`) opt-out sweep (follow-up)

Running `next dev` surfaced a new-to-16.x diagnostic on nearly every route:

```
Error: Route "/": Next.js encountered uncached data during prerendering or a navigation.
`fetch(...)` or `connection()` accessed outside of `<Suspense>` prevents the route from
being prerendered or the navigation from being instant...
```

This is the "instant navigation validation" feature that ships with `cacheComponents`
(already enabled in `next.config.ts` before this upgrade — confirmed via `git log`, not
something this upgrade added). It's a **dev-only warning**: it doesn't fail `next build`
or affect production behavior; `next start` doesn't run this validation at all today. Every
route in this app reads request-time data (DB queries, `auth.api.getSession()`/`headers()`)
without the `<Suspense>`-streaming architecture the feature expects, so essentially the
whole app tripped it.

Rather than hand-writing `<Suspense>` boundaries and `use cache`/`use cache: private`
directives across dozens of pages and layouts — a real architectural change with
correctness stakes, especially around session-derived data that must never be cached
across users — this was fixed using Next's own officially-documented bulk migration path
for exactly this situation ([Migrating to Cache Components §Adopting incrementally](https://nextjs.org/docs/app/guides/migrating-to-cache-components#adopting-incrementally)):

```bash
npx @next/codemod@canary cache-components-instant-false ./app
```

This adds `export const instant = false` (with a `TODO: Cache Components adoption` comment
linking back to the migration guide) to every `page`/`layout`/`default` segment that didn't
already declare `instant` — 62 files, all one-line-conceptually diffs. `instant = false`
marks a segment as "allowed to block"; it does **not** change rendering behavior, caching,
or correctness — these routes were already fully dynamic in practice, this just tells Next
that's intentional and suppresses the validation warning for them. One file
(`app/products/[id]/page.tsx`) picked up unrelated cosmetic reformatting from the codemod's
AST reprint (extra parens around a JSX conditional, a stray semicolon) — manually reverted
to match the file's existing no-semicolon style; the `instant = false` addition itself was
untouched.

This is explicitly an **interim, incremental opt-out**, not a fix — see the `TODO` comment
in each file. A real adoption (wrapping request-time reads in `<Suspense>`, adding
`use cache`/`use cache: private` where data can be cached) is future work, done one route at
a time per Next's migration guide, not part of this pass.

Verified via `npm run build` (clean), `npm run lint` (clean, same pre-existing warning),
`npm run test` (same 1039/16 baseline), and a live `next dev` check confirming the
diagnostic no longer appears for `/` or `/admin`.
