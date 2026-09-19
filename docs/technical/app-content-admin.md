# App Content Admin (About Us / Follow Us / Help & Support / Terms & Conditions)

## What changed

Added a new admin feature for managing app content areas, with a draft/publish workflow:

- `drizzle/schema/app-content-schema.ts` — `app_content_section` table (`about_us`, `follow_us`, `help_support`, `terms_conditions`)
- `features/app-content/` — schemas, db layer, cache layer, permissions, actions, components
- `features/rbac/feature-keys.ts` — `SETTINGS_APP_CONTENT` feature key
- `app/admin/app-content/page.tsx` — the admin page
- `export const instant = false` on that page — opts out of Cache Components Instant Navigation validation (`connection()` + session + draft DB read are request-time; same pattern as `app/admin/queue/page.tsx`)
- `app/api/mobile/about-us`, `/follow-us`, `/help-support`, `/terms-conditions` — public read endpoints
- `features/app-content/actions/app-content-icon.ts` — `uploadAppContentIconAction`, custom Follow Us icon upload (admin-only Server Action, not a route)
- `components/admin/AdminSidebar.tsx` — "App Content" nav entry under Settings

Terms & Conditions uses BlockNote + Google Translate (EN → MY/TH/KO). See `docs/technical/app-content-terms-conditions.md`.

## Data flow

1. Admin edits a tab in `AppContentClient` (client-side state only, nothing persisted yet).
2. **Save** sends only the **active tab’s** payload to `saveAppContentAction`, which validates via that section’s Zod schema, then `saveAppContentDraft` upserts both `draft_content` and `published_content` (live for mobile) and clears `has_unpublished_changes`. Terms saved while editing English may auto-translate before upsert. Cache is revalidated on save.
3. Mobile routes read `published_content` only, through `"use cache"`-wrapped getters in `features/app-content/db/cache/app-content.ts`. They filter to `isActive` items and sort by `sortOrder` for lists (Follow Us platforms, FAQs).

## Schema

Single generic table, `app_content_section`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `section` | enum(`about_us`,`follow_us`,`help_support`,`terms_conditions`) | unique |
| `draft_content` | jsonb | shape validated by Zod, not by the DB |
| `published_content` | jsonb, nullable | null until first publish |
| `has_unpublished_changes` | boolean | drives the "Unsaved changes" pill and whether Publish is enabled |
| `updated_at` / `updated_by_name` | timestamp / text | stamped on every draft save |
| `published_at` / `published_by_name` | timestamp / text, nullable | stamped on publish |

Migration `0091_terms_conditions_section.sql` adds the `terms_conditions` enum value.

## Auth & permissions

- Admin page: `requireFeatureAccess(FEATURE_KEYS.SETTINGS_APP_CONTENT)` — admins always pass; internal users need the `settings.app_content` permission granted via the RBAC admin UI.
- Server Actions: `requireActionRole(canManageAppContent)` — **admin role only**, even for internal users with the feature-key permission.
- Mobile routes: no auth — public content.
- Icon upload: `uploadAppContentIconAction` — admin role only.

## Edge cases & known limitations

- Report-a-problem is config-only — no submission endpoint or admin inbox.
- About Us still has Terms/Privacy slug + last-updated metadata; full Terms body lives in the Terms & Conditions tab.
- App version is a manually-typed string, not computed from `package.json`.
- Publish is no longer a separate UI step — **Save** writes published content immediately.
- `getAppContentSections` returns hard-coded defaults for any section that has never been saved; mobile routes also default to empty rather than erroring pre-launch.
