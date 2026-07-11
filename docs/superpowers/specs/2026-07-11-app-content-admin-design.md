# App Content Admin (About Us / Follow Us / Help & Support) — Design

## Source

Claude Design project `2b28a12e-04a6-410f-b908-2ac21b37bdc5`, file `App Content Admin.dc.html`. Visual layout, copy, colors, and interaction model (draft/publish, drag-to-reorder, per-platform icons) follow that mockup as the source of truth.

## Goal

Give admins a single page to manage three areas of static/semi-static app content — About Us, Follow Us (social links), and Help & Support (FAQs, contact info, operating hours, report-a-problem config) — with a draft/publish workflow, and expose the published content to the mobile app via public read endpoints.

## Architecture

- New feature module `features/app-content/` (`db/`, `schemas/`, `components/`, `permissions/`), following the shape of `features/rating-tags/` and `features/company-settings/`.
- One admin page: `app/admin/app-content/page.tsx`, tabbed via `?tab=about|follow|help`, added to `AdminSidebar.tsx`'s "Settings" nav group.
- One RBAC feature key: `SETTINGS_APP_CONTENT` (added to `features/rbac/feature-keys.ts`), guarding the admin page via `requireFeatureAccess` and its Server Actions via `requireActionRole(canManageAppContent)` — matching the `rating-tags`/`categories`/`company-settings` convention (no `app/api/admin/*` routes for this feature).
- Three public mobile GET endpoints (no auth), the only genuine REST API routes this feature adds, using the existing `jsonCached()` wrapper: `/api/mobile/about-us`, `/api/mobile/follow-us`, `/api/mobile/help-support`.
- New Supabase Storage bucket `app-content-icons` + `app/api/upload/app-content-icon/route.ts` for custom Follow Us platform icons (same pattern as existing upload routes).
- New dependency: `@dnd-kit/core` + `@dnd-kit/sortable` for drag-to-reorder (first use of a DnD library in this codebase — confirmed acceptable per user request to match the source design exactly).

## Data model

Single table, one row per section — a lightweight "draft vs published" content-versioning table:

```
app_content_section
  id                 uuid, pk
  section            enum('about_us','follow_us','help_support'), unique
  draftContent       jsonb        -- currently-edited content, shape below
  publishedContent   jsonb, null  -- last published snapshot; mobile reads ONLY this
  hasUnpublishedChanges boolean, default false
  updatedAt          timestamp
  updatedByName      text, null   -- admin display name captured at save time
  publishedAt        timestamp, null
  publishedByName    text, null
  createdAt          timestamp
```

Rows are seeded (or lazily created on first save) for all three `section` values. `draftContent`/`publishedContent` shapes are validated by per-section Zod schemas, not by separate DB columns — this keeps one generic table serving three different content shapes without three near-duplicate tables.

### `about_us` content shape

```ts
{
  storyHeading: string,       // default "Our Story"
  storyBody: string,
  termsSlug: string,          // e.g. "terms" -> gemx.app/terms
  termsUpdatedAt: string | null,   // ISO date, set automatically when termsSlug changes
  privacySlug: string,
  privacyUpdatedAt: string | null,
  companyName: string,
  contactAddress: string,
}
```

App version is **not stored** — read from `package.json` at request time and shown read-only in the admin UI ("AUTO" badge). Not part of the mobile response either (app already knows its own version).

### `follow_us` content shape

```ts
{
  platforms: Array<{
    id: string,               // uuid, stable across reorders
    iconKey: 'facebook' | 'instagram' | 'telegram' | 'tiktok' | 'viber' | 'custom',
    customIconUrl: string | null,  // set when iconKey === 'custom'
    label: string,
    value: string,            // display text, e.g. "facebook.com/gemx.app"
    url: string,               // tap target
    isActive: boolean,
    sortOrder: number,
  }>
}
```

### `help_support` content shape

```ts
{
  faqs: Array<{
    id: string,
    question: string,
    answer: string,
    isActive: boolean,
    sortOrder: number,
  }>,
  supportEmail: string,
  supportPhone: string,
  liveChatTelegram: string,
  weekdayHours: string,        // free text, e.g. "9:00–18:00" or "Closed"
  saturdayHours: string,
  sundayHours: string,
  timezone: string,            // default "Asia/Yangon (UTC+06:30)"
  reportFormEnabled: boolean,
  reportCategories: string[],  // e.g. ["Bug","Payment","Fraud"]
  allowScreenshotAttachments: boolean,
}
```

## Draft/Publish workflow

Matches the mockup's global top bar (Save draft / Publish to app / "Unsaved changes" pill / "Edited N ago · Name"), spanning all three tabs rather than per-tab. **Admin-side reads and writes follow this codebase's existing convention — Server Actions + direct server-component DB calls, never `app/api/admin/*` REST routes** (confirmed against `features/rating-tags`, `features/categories`, `features/company-settings`, which all use this pattern with zero exceptions):

- **Initial read**: `app/admin/app-content/page.tsx` is an async server component. It calls `requireFeatureAccess(FEATURE_KEYS.SETTINGS_APP_CONTENT)`, then `await getAppContentSections()` (from `features/app-content/db/app-content.ts`) directly — no API route — and passes `draftContent` + metadata (`hasUnpublishedChanges`, `updatedAt`/`By`, `publishedAt`/`By`) for all three sections as props to the client tab components, which render the "Unsaved changes" pill and attribution line.
- The client holds all three sections' edited state in memory as the admin moves between tabs (plain `useState`, no `useTransition` needed — matches `RatingTagForm.tsx`'s style).
- **Save draft** → `saveAppContentAction(payload)` server action in `features/app-content/actions/app-content.ts` — `"use server"`, validates `{ aboutUs, followUs, helpSupport }` against each section's Zod schema, calls `requireActionRole(canManageAppContent)` (new predicate in `features/rbac/`) inside the action, upserts `draftContent`/`updatedAt`/`updatedByName` for changed sections via the db layer, revalidates the relevant cache tag, returns `{ success }` / `{ error }`.
- **Publish to app** → `publishAppContentAction()` server action — same guard, for each section with `hasUnpublishedChanges = true` copies `draftContent → publishedContent`, sets `publishedAt`/`publishedByName`, clears `hasUnpublishedChanges`, all in one DB transaction, revalidates cache, returns `{ success }` / `{ error }`.
- Mobile endpoints (unaffected by this change — they're genuine public REST routes since the mobile app is a separate HTTP client) read `publishedContent` only. If a section has never been published, return sensible empty defaults (empty array / empty strings) with `200`, not an error — the app must not break before first publish.

## Admin UI

- **Tab bar**: About us / Follow us / Help & Support, persisted via `?tab=`.
- **Top bar** (persistent across tabs): breadcrumb, "Unsaved changes" pill (shown when any section is dirty), "Edited N ago · Name" (most recent `updatedAt` across the three sections), "Save draft" button, "Publish to app" button (disabled when nothing is dirty).
- **About us tab**: heading input, story textarea, Terms/Privacy slug inputs (each showing computed "last updated" date), company name input, contact address textarea, read-only app version chip.
- **Follow us tab**: drag-to-reorder list of platform rows (`@dnd-kit`) — icon (built-in or custom upload), label, value/url inputs, active/inactive toggle, delete with confirm. "Add platform" — pick a built-in brand icon or upload a custom one, enter label/value/url.
- **Help & Support tab**: drag-to-reorder FAQ list (question/answer, active toggle, add/delete), Contact channels card (email/phone/Telegram), Operating hours card (weekday/Saturday/Sunday text + timezone), Report-a-problem card (enabled toggle, category chips add/remove, allow-screenshots toggle).

## Mobile API responses

- `GET /api/mobile/about-us` → `{ storyHeading, storyBody, terms: { slug, updatedAt }, privacy: { slug, updatedAt }, companyName, contactAddress, appVersion }` (appVersion computed server-side from `package.json`).
- `GET /api/mobile/follow-us` → `{ platforms: [{ iconKey, customIconUrl, label, value, url }] }` — only `isActive`, sorted by `sortOrder`.
- `GET /api/mobile/help-support` → `{ faqs: [...active, sorted...], contact: { email, phone, telegram }, hours: { weekday, saturday, sunday, timezone }, reportForm: { enabled, categories, allowScreenshots } }`.

## Testing

- `tests/unit/`: Zod schemas for each section shape; publish-promotion logic (draft→published copy, dirty-flag clearing); `package.json` version read helper; `saveAppContentAction`/`publishAppContentAction` (mocked `requireActionRole` + Drizzle) — validation failure, unauthorized, happy-path save, happy-path publish (with and without pending changes per section).
- `tests/api/`: mobile `GET` routes only (active-filter + sort behavior, empty-before-publish default) — these are the only real API routes this feature adds.
- `tests/component/`: reorder handler logic (sortOrder recompute on drag end), not full DnD simulation.

## Known limitations / explicitly out of scope

- No rich-text editor for Terms/Privacy — only slug + last-updated metadata, per mockup.
- Report-a-problem is config-only; no submission pipeline (no POST endpoint, no admin inbox) in this build.
- No per-tab independent publish — publish is global across all three sections, matching the single top-bar action in the source design.
