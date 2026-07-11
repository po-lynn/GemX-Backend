# App Content Admin — Collaborator Guide

## Prerequisites

- The `app_content_section` migration must be applied (`npm run db:generate` then apply manually — see the project's migration workflow).
- No new env vars beyond what uploads already need (`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`) if you plan to test custom icon uploads.
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` are installed via `npm install`.

## Using the feature

1. Log in as an admin (or an internal user granted the `settings.app_content` permission) and go to **Admin → Settings → App Content** (`/admin/app-content`).
2. Edit any of the three tabs — About us / Follow us / Help & Support. Edits are local until you save.
3. Click **Save draft** to persist your changes (they are not yet visible to the mobile app).
4. Click **Publish to app** to make the current draft live. The mobile app reads only published content via:
   - `GET /api/mobile/about-us`
   - `GET /api/mobile/follow-us`
   - `GET /api/mobile/help-support`

## Extending the feature

**Add a new field to an existing section** (e.g. a new About Us field):
1. Add the field to the relevant Zod schema in `features/app-content/schemas/app-content.ts`.
2. Add it to the matching `DEFAULT_*_CONTENT` constant in `features/app-content/db/app-content.ts`.
3. Add the input to the relevant tab component (`AboutUsTab.tsx` / `FollowUsTab.tsx` / `HelpSupportTab.tsx`).
4. If the mobile app needs it, add it to the relevant `app/api/mobile/*/route.ts` response shape.
5. No schema migration is needed — the field lives inside the `jsonb` column.

**Add a new section (fourth tab)**:
1. Add the new value to `appContentSectionEnum` in `drizzle/schema/app-content-schema.ts` (requires a migration).
2. Add a Zod schema + type + default content constant.
3. Add a `getPublished<Section>()` function and cached getter.
4. Add the tab to `AppContentClient.tsx` and a new tab component.
5. Add a new mobile route if the app needs to read it.

## Common errors

- **"Nothing to save" / "Nothing to publish"**: returned when the action is called with no changed sections (Save) or no section has `has_unpublished_changes` (Publish) — not a bug, just nothing to do.
- **Icon upload returns `{ error: "Unauthorized" }`**: `uploadAppContentIconAction` requires an admin session; confirm you're logged into the admin panel as an admin (internal users with the feature-key permission can still see the page, but this action is admin-role-only).
- **Icon upload returns `{ error: "Supabase upload not configured." }`**: `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_URL` are missing from `.env.local` — see `lib/supabase/server.ts`'s error message.
- **Mobile route returns empty content**: the section has never been published — publish it from the admin page first.
