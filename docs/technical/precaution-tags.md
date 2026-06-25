# Precaution Tags — Technical Notes

## What changed

New feature: admin-managed safety advisories shown to buyers before they chat, call, or pay on GemX.

### Files touched

**New schema**
- `drizzle/schema/precaution-tag-schema.ts` — `precaution_tags` table with two enums
- `drizzle/schema.ts` — added export

**New feature module**
- `features/precaution-tags/db/precaution-tags.ts` — CRUD query layer
- `features/precaution-tags/db/cache/precaution-tags.ts` — Next.js `"use cache"` wrapper + revalidation
- `features/precaution-tags/schemas/precaution-tags.ts` — Zod validation schemas
- `features/precaution-tags/actions/precaution-tags.ts` — server actions (create / update / delete)
- `features/precaution-tags/permissions/precaution-tags.ts` — `canAdminManagePrecautionTags(role)`
- `features/precaution-tags/components/PrecautionTagsListView.tsx` — admin list view
- `features/precaution-tags/components/PrecautionTagForm.tsx` — create / edit form

**Admin pages**
- `app/admin/settings/precaution-tags/page.tsx` — list with view tabs
- `app/admin/settings/precaution-tags/new/page.tsx` — create form
- `app/admin/settings/precaution-tags/[id]/edit/page.tsx` — edit form

**RBAC / nav**
- `features/rbac/feature-keys.ts` — added `SETTINGS_PRECAUTION_TAGS = "settings.precaution_tags"`
- `components/admin/AdminSidebar.tsx` — added ShieldAlert nav item under Settings group

**CSS**
- `app/admin-list-view.css` — `pct-*` block appended (severity pill, applies-to pill, tag chip, hero card, head icon)

---

## Data flow

```
schema (drizzle/schema/precaution-tag-schema.ts)
  → DB queries (features/precaution-tags/db/precaution-tags.ts)
  → cache layer (db/cache/precaution-tags.ts) — "use cache" + tag-based revalidation
  → server actions (actions/precaution-tags.ts) — RBAC guard → validate → mutate → revalidate
  → admin pages (app/admin/settings/precaution-tags/*)
  → React components (PrecautionTagsListView, PrecautionTagForm)
```

---

## Schema

```sql
-- Two new Postgres enums
CREATE TYPE precaution_tag_severity AS ENUM ('critical', 'warning', 'info');
CREATE TYPE precaution_tag_applies_to AS ENUM ('certified', 'non_certified', 'both');

CREATE TABLE precaution_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  severity   precaution_tag_severity   NOT NULL,
  applies_to precaution_tag_applies_to NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> **Migration:** Run `npm run db:generate` then pass to the user to apply with `npm run db:migrate`.

---

## Auth & permissions

- All admin pages: `requireFeatureAccess(FEATURE_KEYS.SETTINGS_PRECAUTION_TAGS)` — redirects if unauthorized.
- Server actions: `requireActionRole(canAdminManagePrecautionTags)` — returns `null` + `{ error: "Unauthorized" }` for non-admins.
- `canAdminManagePrecautionTags(role)` → `role === "admin"` only (same policy as rating tags).
- New RBAC permission key `settings.precaution_tags` is available in the Permissions admin page for supervisor delegation.

---

## Edge cases & known limitations

- No foreign-key references to `precaution_tags` yet — deletion is always safe.
- `appliesTo = "both"` rows appear in both the Certified and Non-Certified tab counts (intentional — they apply to all products).
- Severity sort order in the list view: critical (3) > warning (2) > info (1) — matches the design.
- `isActive = false` hides from buyers but the row stays in DB; no hard-delete from the list view.
