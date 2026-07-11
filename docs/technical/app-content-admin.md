# App Content Admin (About Us / Follow Us / Help & Support)

## What changed

Added a new admin feature for managing three areas of app content, with a draft/publish workflow:

- `drizzle/schema/app-content-schema.ts` — new `app_content_section` table
- `features/app-content/` — schemas, db layer, cache layer, permissions, actions, components
- `features/rbac/feature-keys.ts` — new `SETTINGS_APP_CONTENT` feature key
- `app/admin/app-content/page.tsx` — the admin page
- `app/api/mobile/about-us`, `/follow-us`, `/help-support` — public read endpoints
- `features/app-content/actions/app-content-icon.ts` — `uploadAppContentIconAction`, custom Follow Us icon upload (admin-only Server Action, not a route)
- `components/admin/AdminSidebar.tsx` — new "App Content" nav entry under Settings

## Data flow

1. Admin edits a tab in `AppContentClient` (client-side state only, nothing persisted yet).
2. "Save draft" calls `saveAppContentAction`, which validates via the per-section Zod schema in `features/app-content/schemas/app-content.ts`, then `saveAppContentDraft` upserts `draft_content` and sets `has_unpublished_changes = true` for each changed section (one `app_content_section` row per section, keyed by the unique `section` enum column).
3. "Publish to app" calls `publishAppContentAction`, which promotes every row with `has_unpublished_changes = true`: copies `draft_content` into `published_content`, clears the flag, stamps `published_at`/`published_by_name`, and calls `revalidateAppContentCache()` (a Next.js `updateTag` on the shared `"appContent"` cache tag).
4. The three mobile routes (`/api/mobile/about-us`, `/follow-us`, `/help-support`) read `published_content` only, through `"use cache"`-wrapped getters in `features/app-content/db/cache/app-content.ts`. They filter to `isActive` items and sort by `sortOrder` for lists (Follow Us platforms, FAQs).

## Schema

Single generic table, `app_content_section`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `section` | enum(`about_us`,`follow_us`,`help_support`) | unique |
| `draft_content` | jsonb | shape validated by Zod, not by the DB |
| `published_content` | jsonb, nullable | null until first publish |
| `has_unpublished_changes` | boolean | drives the "Unsaved changes" pill and whether Publish is enabled |
| `updated_at` / `updated_by_name` | timestamp / text | stamped on every draft save |
| `published_at` / `published_by_name` | timestamp / text, nullable | stamped on publish |

No migration was run by the agent that built this — the schema file was created and exported, but `npm run db:generate` / `db:migrate` must be run manually per this project's convention (see `lib/dataCache.ts` and `CLAUDE.md`).

## Auth & permissions

- Admin page: `requireFeatureAccess(FEATURE_KEYS.SETTINGS_APP_CONTENT)` — admins always pass; internal users need the `settings.app_content` permission granted via the RBAC admin UI.
- Server Actions: `requireActionRole(canManageAppContent)` — **admin role only**, even for internal users with the feature-key permission. This matches the existing (if slightly inconsistent) convention in `rating-tags`/`precaution-tags`/`colors` — the page-level guard is feature-key-aware, but action-level guards check the raw role.
- Mobile routes: no auth — public content.
- Icon upload: `uploadAppContentIconAction` — `requireActionRole(canManageAppContent)`, admin role only, same as `saveAppContentAction`/`publishAppContentAction`. Implemented as a Server Action rather than an `app/api/upload/*` route, unlike the buyer/seller-facing upload routes (certificate, KYC, product media), because this one exists solely to serve the App Content admin page.

## Edge cases & known limitations

- Report-a-problem is config-only — no submission endpoint or admin inbox.
- Terms/Privacy are slug + last-updated metadata only, no rich-text body.
- App version is a manually-typed string, not computed from `package.json` (that file versions the backend, not the mobile client).
- Publish is global across all three sections in one action — there is no per-tab independent publish.
- `getAppContentSections` returns hard-coded defaults (empty content) for any section that has never been saved; the mobile routes also default to empty rather than erroring pre-launch.
