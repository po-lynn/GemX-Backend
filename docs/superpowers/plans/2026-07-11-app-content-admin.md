# App Content Admin (About Us / Follow Us / Help & Support) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a page to manage About Us, Follow Us (social links), and Help & Support (FAQs, contact info, hours, report-a-problem config) content, with a global draft/publish workflow, and expose the published content to the mobile app via three public read endpoints.

**Architecture:** One generic Drizzle table (`app_content_section`) stores draft/published JSON snapshots per section. Admin reads/writes go through a server component page + Server Actions (this codebase's established convention — no `app/api/admin/*` routes). Three public `GET` routes under `/api/mobile/*` serve `publishedContent` only. Drag-to-reorder (Follow Us platforms, FAQs) uses `@dnd-kit`, the first DnD library in this codebase.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (Postgres/Supabase), Zod, Better Auth, `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` (new dependency), Vitest.

## Global Constraints

- Follow the spec at `docs/superpowers/specs/2026-07-11-app-content-admin-design.md` — read it before starting if anything here is ambiguous.
- Admin-side reads/writes use Server Actions + direct server-component DB calls. **Never** create `app/api/admin/*` routes for this feature.
- **Never run `npm run db:generate`, `npm run db:migrate`, or `npm run db:push`.** The user applies all migrations manually. Task 1 ends by asking the user to run `npm run db:generate` themselves — do not run it for them.
- Mobile endpoints are `GET`-only, public (no auth), using `jsonCached()` from `lib/api.ts`.
- Report-a-problem is config-only in this build — no submission endpoint, no admin inbox.
- Terms/Privacy are slug + last-updated metadata only — no rich-text body.
- App version is a manually-entered text field, not auto-computed (see spec's correction note).
- Run `npm run test` after every task's test step and confirm the new tests pass before moving on.

---

## File Structure

New files:
- `drizzle/schema/app-content-schema.ts` — the `app_content_section` table + `appContentSectionEnum`
- `drizzle/schema.ts` — add one export line
- `lib/dataCache.ts` — add `"appContent"` to the `CACHE_TAG` union
- `features/app-content/schemas/app-content.ts` — Zod schemas for all three content shapes + save payload
- `features/app-content/lib/reorder.ts` — pure `reorderBySortOrder` helper shared by both draggable lists
- `features/app-content/db/app-content.ts` — get/save/publish DB functions + defaults
- `features/app-content/db/cache/app-content.ts` — cached published-content getters + revalidation
- `features/app-content/permissions/app-content.ts` — `canManageAppContent`
- `features/app-content/actions/app-content.ts` — `saveAppContentAction`, `publishAppContentAction`
- `features/rbac/feature-keys.ts` — add `SETTINGS_APP_CONTENT` key + Settings group entry (modify)
- `app/api/mobile/about-us/route.ts`, `app/api/mobile/follow-us/route.ts`, `app/api/mobile/help-support/route.ts`
- `lib/supabase/server.ts` — add `APP_CONTENT_ICONS_BUCKET` constant (modify)
- `features/app-content/actions/app-content-icon.ts` — `uploadAppContentIconAction` (custom platform icon upload, admin-only)
- `app/admin/app-content/page.tsx` — server component page (auth guard, data fetch)
- `app/admin/app-content/app-content.css` — scoped styles for this feature
- `features/app-content/components/AppContentClient.tsx` — tab state, dirty tracking, save/publish top bar
- `features/app-content/components/SortableList.tsx` — generic dnd-kit list wrapper
- `features/app-content/components/PlatformIcon.tsx` — built-in/custom icon renderer
- `features/app-content/components/AboutUsTab.tsx`
- `features/app-content/components/FollowUsTab.tsx`
- `features/app-content/components/HelpSupportTab.tsx`
- `components/admin/AdminSidebar.tsx` — add nav entry (modify)
- `package.json` — add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (modify)

Tests:
- `tests/unit/app-content-schemas.test.ts`
- `tests/unit/app-content-reorder.test.ts`
- `tests/unit/app-content-db.test.ts`
- `tests/unit/app-content-actions.test.ts`
- `tests/unit/app-content-icon-action.test.ts`
- `tests/api/mobile/about-us.test.ts`
- `tests/api/mobile/follow-us.test.ts`
- `tests/api/mobile/help-support.test.ts`

Docs (per CLAUDE.md "After Every Change"):
- `docs/technical/app-content-admin.md`
- `docs/guides/app-content-admin.md`
- `docs/api/mobile-about-us.md`, `docs/api/mobile-follow-us.md`, `docs/api/mobile-help-support.md`
- `docs/MOBILE-API.md` — add the three new endpoints to the contract doc (modify)

---

### Task 1: Dependencies + Drizzle schema

**Files:**
- Modify: `package.json`
- Create: `drizzle/schema/app-content-schema.ts`
- Modify: `drizzle/schema.ts`
- Modify: `lib/dataCache.ts`

**Interfaces:**
- Produces: `appContentSection` (Drizzle table), `appContentSectionEnum` — consumed by Task 3's db layer.
- Produces: `CACHE_TAG` now includes `"appContent"` — consumed by Task 3's cache layer.

- [ ] **Step 1: Install the DnD dependencies**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

Expected: `package.json` and `package-lock.json` gain the three entries under `dependencies`.

- [ ] **Step 2: Create the Drizzle schema file**

Create `drizzle/schema/app-content-schema.ts`:

```ts
import { boolean, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

/** Which content area a row represents. Exactly one row per value, enforced by the unique constraint on `section`. */
export const appContentSectionEnum = pgEnum("app_content_section_name", [
  "about_us",
  "follow_us",
  "help_support",
])

/**
 * Draft/published content versioning for the About Us / Follow Us / Help & Support
 * admin page. `draftContent` is what the admin edits; `publishedContent` is what
 * the mobile app reads. Publish copies draft -> published and clears the dirty flag.
 */
export const appContentSection = pgTable("app_content_section", {
  id: uuid("id").primaryKey().defaultRandom(),
  section: appContentSectionEnum("section").notNull().unique(),
  draftContent: jsonb("draft_content").notNull(),
  publishedContent: jsonb("published_content"),
  hasUnpublishedChanges: boolean("has_unpublished_changes").notNull().default(false),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  updatedByName: text("updated_by_name"),
  publishedAt: timestamp("published_at"),
  publishedByName: text("published_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
```

- [ ] **Step 3: Export the new schema from the barrel file**

In `drizzle/schema.ts`, find the block of `export * from "./schema/..."` lines (e.g. near the `company-settings-schema` export) and add:

```ts
export * from "./schema/app-content-schema"
```

- [ ] **Step 4: Add the cache tag**

In `lib/dataCache.ts`, add `"appContent"` to the `CACHE_TAG` union:

```ts
export type CACHE_TAG =
  | "products"
  | "users"
  | "category"
  | "categories"
  | "laboratory"
  | "origin"
  | "color"
  | "ratingTag"
  | "precautionTag"
  | "appContent"
  | "profile"
  | "home"
  | "rankedProducts"
  | "rankedProductsUser"
```

- [ ] **Step 5: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors (the table isn't used by any code yet, so this just confirms the schema file itself is valid TypeScript).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json drizzle/schema/app-content-schema.ts drizzle/schema.ts lib/dataCache.ts
git commit -m "feat: add app_content_section schema and dnd-kit dependency"
```

- [ ] **Step 7: Ask the user to generate and apply the migration**

Tell the user: "Please run `npm run db:generate` and then apply the resulting migration yourself (per your usual workflow) — I don't run migration commands." Do not proceed to run these commands. Wait for the user to confirm the table exists before Task 3's tests are expected to pass against a real database (the unit tests in this plan mock Drizzle, so they don't require the table to exist — only manual/integration testing later does).

---

### Task 2: Zod schemas

**Files:**
- Create: `features/app-content/schemas/app-content.ts`
- Test: `tests/unit/app-content-schemas.test.ts`

**Interfaces:**
- Produces: `socialPlatformSchema`, `faqItemSchema`, `aboutUsContentSchema`, `followUsContentSchema`, `helpSupportContentSchema`, `saveAppContentSchema` (all Zod schemas) and their inferred types `SocialPlatform`, `FaqItem`, `AboutUsContent`, `FollowUsContent`, `HelpSupportContent`, `SaveAppContentInput` — consumed by Task 3 (db layer), Task 5 (actions), Tasks 10-12 (tab components).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/app-content-schemas.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  socialPlatformSchema,
  faqItemSchema,
  aboutUsContentSchema,
  followUsContentSchema,
  helpSupportContentSchema,
  saveAppContentSchema,
} from "@/features/app-content/schemas/app-content"

const PLATFORM = {
  id: "00000000-0000-4000-8000-000000000001",
  iconKey: "facebook",
  customIconUrl: null,
  label: "Facebook",
  value: "facebook.com/gemx.app",
  url: "https://facebook.com/gemx.app",
  isActive: true,
  sortOrder: 0,
}

const FAQ = {
  id: "00000000-0000-4000-8000-000000000002",
  question: "How do I sell an item?",
  answer: "Tap the + button.",
  isActive: true,
  sortOrder: 0,
}

const ABOUT_US = {
  storyHeading: "Our Story",
  storyBody: "GemX began in 2019.",
  termsSlug: "terms",
  termsUpdatedAt: null,
  privacySlug: "privacy",
  privacyUpdatedAt: null,
  companyName: "GemX Technologies Ltd.",
  contactAddress: "Yangon, Myanmar",
  appVersion: "v2.4.1",
}

const HELP_SUPPORT = {
  faqs: [FAQ],
  supportEmail: "support@gemx.app",
  supportPhone: "+95 9 250 000 111",
  liveChatTelegram: "t.me/gemxsupport",
  weekdayHours: "9:00–18:00",
  saturdayHours: "10:00–15:00",
  sundayHours: "Closed",
  timezone: "Asia/Yangon (UTC+06:30)",
  reportFormEnabled: true,
  reportCategories: ["Bug", "Payment"],
  allowScreenshotAttachments: true,
}

describe("socialPlatformSchema", () => {
  it("accepts a valid built-in platform", () => {
    expect(socialPlatformSchema.safeParse(PLATFORM).success).toBe(true)
  })

  it("rejects a custom icon with no customIconUrl (allowed to be null even for custom)", () => {
    // customIconUrl is nullable regardless of iconKey — the UI is responsible for
    // requiring an upload when iconKey is "custom"; the schema only validates shape.
    const result = socialPlatformSchema.safeParse({ ...PLATFORM, iconKey: "custom", customIconUrl: null })
    expect(result.success).toBe(true)
  })

  it("rejects an empty label", () => {
    expect(socialPlatformSchema.safeParse({ ...PLATFORM, label: "" }).success).toBe(false)
  })

  it("rejects an invalid iconKey", () => {
    expect(socialPlatformSchema.safeParse({ ...PLATFORM, iconKey: "snapchat" }).success).toBe(false)
  })

  it("rejects a negative sortOrder", () => {
    expect(socialPlatformSchema.safeParse({ ...PLATFORM, sortOrder: -1 }).success).toBe(false)
  })
})

describe("faqItemSchema", () => {
  it("accepts a valid FAQ", () => {
    expect(faqItemSchema.safeParse(FAQ).success).toBe(true)
  })

  it("rejects an empty question", () => {
    expect(faqItemSchema.safeParse({ ...FAQ, question: "" }).success).toBe(false)
  })
})

describe("aboutUsContentSchema", () => {
  it("accepts valid about-us content", () => {
    expect(aboutUsContentSchema.safeParse(ABOUT_US).success).toBe(true)
  })

  it("accepts an empty storyBody (no content yet is valid)", () => {
    expect(aboutUsContentSchema.safeParse({ ...ABOUT_US, storyBody: "" }).success).toBe(true)
  })

  it("rejects a missing storyHeading", () => {
    const { storyHeading: _drop, ...rest } = ABOUT_US
    expect(aboutUsContentSchema.safeParse(rest).success).toBe(false)
  })
})

describe("followUsContentSchema", () => {
  it("accepts an empty platforms array", () => {
    expect(followUsContentSchema.safeParse({ platforms: [] }).success).toBe(true)
  })

  it("accepts a list of valid platforms", () => {
    expect(followUsContentSchema.safeParse({ platforms: [PLATFORM] }).success).toBe(true)
  })
})

describe("helpSupportContentSchema", () => {
  it("accepts valid help & support content", () => {
    expect(helpSupportContentSchema.safeParse(HELP_SUPPORT).success).toBe(true)
  })

  it("accepts an empty supportEmail (optional field)", () => {
    expect(helpSupportContentSchema.safeParse({ ...HELP_SUPPORT, supportEmail: "" }).success).toBe(true)
  })

  it("rejects a malformed supportEmail", () => {
    expect(helpSupportContentSchema.safeParse({ ...HELP_SUPPORT, supportEmail: "not-an-email" }).success).toBe(false)
  })
})

describe("saveAppContentSchema", () => {
  it("accepts all three sections omitted (nothing to save)", () => {
    expect(saveAppContentSchema.safeParse({}).success).toBe(true)
  })

  it("accepts a payload with only one section present", () => {
    expect(saveAppContentSchema.safeParse({ aboutUs: ABOUT_US }).success).toBe(true)
  })

  it("rejects a payload with an invalid nested section", () => {
    expect(
      saveAppContentSchema.safeParse({ aboutUs: { ...ABOUT_US, storyHeading: "" } }).success
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/app-content-schemas.test.ts`
Expected: FAIL — `Cannot find module '@/features/app-content/schemas/app-content'`

- [ ] **Step 3: Write the schema implementation**

Create `features/app-content/schemas/app-content.ts`:

```ts
import { z } from "zod"

export const socialIconKeySchema = z.enum([
  "facebook",
  "instagram",
  "telegram",
  "tiktok",
  "viber",
  "custom",
])

export const socialPlatformSchema = z.object({
  id: z.string().uuid(),
  iconKey: socialIconKeySchema,
  customIconUrl: z.string().url().nullable(),
  label: z.string().min(1, "Label is required").max(60),
  value: z.string().min(1, "Value is required").max(200),
  url: z.string().min(1, "URL is required").max(500),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0),
})

export const faqItemSchema = z.object({
  id: z.string().uuid(),
  question: z.string().min(1, "Question is required").max(300),
  answer: z.string().min(1, "Answer is required").max(2000),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0),
})

export const aboutUsContentSchema = z.object({
  storyHeading: z.string().min(1, "Heading is required").max(100),
  storyBody: z.string().max(5000),
  termsSlug: z.string().max(100),
  termsUpdatedAt: z.string().nullable(),
  privacySlug: z.string().max(100),
  privacyUpdatedAt: z.string().nullable(),
  companyName: z.string().max(200),
  contactAddress: z.string().max(500),
  appVersion: z.string().max(30),
})

export const followUsContentSchema = z.object({
  platforms: z.array(socialPlatformSchema).max(50),
})

export const helpSupportContentSchema = z.object({
  faqs: z.array(faqItemSchema).max(100),
  supportEmail: z.string().email("Invalid email").or(z.literal("")),
  supportPhone: z.string().max(40),
  liveChatTelegram: z.string().max(100),
  weekdayHours: z.string().max(50),
  saturdayHours: z.string().max(50),
  sundayHours: z.string().max(50),
  timezone: z.string().max(60),
  reportFormEnabled: z.boolean(),
  reportCategories: z.array(z.string().min(1).max(40)).max(20),
  allowScreenshotAttachments: z.boolean(),
})

export const saveAppContentSchema = z.object({
  aboutUs: aboutUsContentSchema.optional(),
  followUs: followUsContentSchema.optional(),
  helpSupport: helpSupportContentSchema.optional(),
})

export type SocialPlatform = z.infer<typeof socialPlatformSchema>
export type FaqItem = z.infer<typeof faqItemSchema>
export type AboutUsContent = z.infer<typeof aboutUsContentSchema>
export type FollowUsContent = z.infer<typeof followUsContentSchema>
export type HelpSupportContent = z.infer<typeof helpSupportContentSchema>
export type SaveAppContentInput = z.infer<typeof saveAppContentSchema>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/app-content-schemas.test.ts`
Expected: PASS (19 tests)

- [ ] **Step 5: Commit**

```bash
git add features/app-content/schemas/app-content.ts tests/unit/app-content-schemas.test.ts
git commit -m "feat: add Zod schemas for app content sections"
```

---

### Task 3: DB layer + cache layer

**Files:**
- Create: `features/app-content/db/app-content.ts`
- Create: `features/app-content/db/cache/app-content.ts`
- Test: `tests/unit/app-content-db.test.ts`

**Interfaces:**
- Consumes: `AboutUsContent`, `FollowUsContent`, `HelpSupportContent` from Task 2; `appContentSection` from Task 1.
- Produces: `AppContentSectionName`, `AppContentSectionRow<T>`, `AppContentSections` types; `DEFAULT_ABOUT_US_CONTENT`, `DEFAULT_FOLLOW_US_CONTENT`, `DEFAULT_HELP_SUPPORT_CONTENT`; `getAppContentSections(): Promise<AppContentSections>`; `saveAppContentDraft(input): Promise<void>`; `publishAppContentSections(publishedByName: string): Promise<{ published: AppContentSectionName[] }>`; `getPublishedAboutUs/FollowUs/HelpSupport(): Promise<T>` — consumed by Task 5 (actions), Task 7 (mobile routes), Task 9 (admin page).
- Produces (cache): `getCachedPublishedAboutUs/FollowUs/HelpSupport()`, `revalidateAppContentCache()` — consumed by Task 5 and Task 7.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/app-content-db.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/drizzle/db"
import {
  getAppContentSections,
  saveAppContentDraft,
  publishAppContentSections,
  getPublishedAboutUs,
  DEFAULT_ABOUT_US_CONTENT,
  DEFAULT_FOLLOW_US_CONTENT,
  DEFAULT_HELP_SUPPORT_CONTENT,
} from "@/features/app-content/db/app-content"

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => `eq:${val}`),
}))

vi.mock("@/drizzle/schema/app-content-schema", () => ({
  appContentSection: {
    id: "id",
    section: "section",
    draftContent: "draft_content",
    publishedContent: "published_content",
    hasUnpublishedChanges: "has_unpublished_changes",
    updatedAt: "updated_at",
    updatedByName: "updated_by_name",
    publishedAt: "published_at",
    publishedByName: "published_by_name",
  },
}))

vi.mock("@/drizzle/db", () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}))

function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  for (const m of ["from", "where", "limit"]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject)
  return chain
}

const NOW = new Date("2026-07-11T00:00:00.000Z")

describe("getAppContentSections", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns defaults for sections with no row yet", async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never)
    const result = await getAppContentSections()
    expect(result.aboutUs.draftContent).toEqual(DEFAULT_ABOUT_US_CONTENT)
    expect(result.followUs.draftContent).toEqual(DEFAULT_FOLLOW_US_CONTENT)
    expect(result.helpSupport.draftContent).toEqual(DEFAULT_HELP_SUPPORT_CONTENT)
    expect(result.aboutUs.hasUnpublishedChanges).toBe(false)
    expect(result.aboutUs.publishedContent).toBeNull()
  })

  it("maps an existing row onto its section", async () => {
    const aboutUsContent = { ...DEFAULT_ABOUT_US_CONTENT, companyName: "GemX Ltd." }
    vi.mocked(db.select).mockReturnValueOnce(
      selectChain([
        {
          section: "about_us",
          draftContent: aboutUsContent,
          publishedContent: null,
          hasUnpublishedChanges: true,
          updatedAt: NOW,
          updatedByName: "Elena M.",
          publishedAt: null,
          publishedByName: null,
        },
      ]) as never
    )
    const result = await getAppContentSections()
    expect(result.aboutUs.draftContent).toEqual(aboutUsContent)
    expect(result.aboutUs.hasUnpublishedChanges).toBe(true)
    expect(result.aboutUs.updatedByName).toBe("Elena M.")
    expect(result.followUs.draftContent).toEqual(DEFAULT_FOLLOW_US_CONTENT)
  })
})

describe("saveAppContentDraft", () => {
  beforeEach(() => vi.clearAllMocks())

  it("upserts only the sections that were provided", async () => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate })
    const insert = vi.fn().mockReturnValue({ values })
    const tx = { insert }
    vi.mocked(db.transaction).mockImplementation(async (fn) => fn(tx as never))

    await saveAppContentDraft({
      aboutUs: DEFAULT_ABOUT_US_CONTENT,
      updatedByName: "Elena M.",
    })

    expect(insert).toHaveBeenCalledTimes(1)
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "about_us",
        draftContent: DEFAULT_ABOUT_US_CONTENT,
        hasUnpublishedChanges: true,
        updatedByName: "Elena M.",
      })
    )
  })

  it("does nothing when no section is provided", async () => {
    await saveAppContentDraft({ updatedByName: "Elena M." })
    expect(db.transaction).not.toHaveBeenCalled()
  })
})

describe("publishAppContentSections", () => {
  beforeEach(() => vi.clearAllMocks())

  it("promotes only sections with pending changes and returns their names", async () => {
    const update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    })
    const tx = {
      select: vi.fn().mockReturnValue(
        selectChain([{ id: "row-1", section: "about_us", draftContent: DEFAULT_ABOUT_US_CONTENT }])
      ),
      update,
    }
    vi.mocked(db.transaction).mockImplementation(async (fn) => fn(tx as never))

    const result = await publishAppContentSections("Elena M.")
    expect(result.published).toEqual(["about_us"])
    expect(update).toHaveBeenCalledTimes(1)
  })

  it("returns an empty published list when nothing is pending", async () => {
    const tx = { select: vi.fn().mockReturnValue(selectChain([])), update: vi.fn() }
    vi.mocked(db.transaction).mockImplementation(async (fn) => fn(tx as never))

    const result = await publishAppContentSections("Elena M.")
    expect(result.published).toEqual([])
    expect(tx.update).not.toHaveBeenCalled()
  })
})

describe("getPublishedAboutUs", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns the default when never published", async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never)
    await expect(getPublishedAboutUs()).resolves.toEqual(DEFAULT_ABOUT_US_CONTENT)
  })

  it("returns the published snapshot when present", async () => {
    const content = { ...DEFAULT_ABOUT_US_CONTENT, companyName: "GemX Ltd." }
    vi.mocked(db.select).mockReturnValueOnce(selectChain([{ publishedContent: content }]) as never)
    await expect(getPublishedAboutUs()).resolves.toEqual(content)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/app-content-db.test.ts`
Expected: FAIL — `Cannot find module '@/features/app-content/db/app-content'`

- [ ] **Step 3: Write the DB layer implementation**

Create `features/app-content/db/app-content.ts`:

```ts
import { db } from "@/drizzle/db"
import { appContentSection } from "@/drizzle/schema/app-content-schema"
import { eq } from "drizzle-orm"
import type {
  AboutUsContent,
  FollowUsContent,
  HelpSupportContent,
} from "@/features/app-content/schemas/app-content"

export type AppContentSectionName = "about_us" | "follow_us" | "help_support"

export type AppContentSectionRow<T> = {
  draftContent: T
  publishedContent: T | null
  hasUnpublishedChanges: boolean
  updatedAt: Date | null
  updatedByName: string | null
  publishedAt: Date | null
  publishedByName: string | null
}

export type AppContentSections = {
  aboutUs: AppContentSectionRow<AboutUsContent>
  followUs: AppContentSectionRow<FollowUsContent>
  helpSupport: AppContentSectionRow<HelpSupportContent>
}

export const DEFAULT_ABOUT_US_CONTENT: AboutUsContent = {
  storyHeading: "Our Story",
  storyBody: "",
  termsSlug: "",
  termsUpdatedAt: null,
  privacySlug: "",
  privacyUpdatedAt: null,
  companyName: "",
  contactAddress: "",
  appVersion: "",
}

export const DEFAULT_FOLLOW_US_CONTENT: FollowUsContent = { platforms: [] }

export const DEFAULT_HELP_SUPPORT_CONTENT: HelpSupportContent = {
  faqs: [],
  supportEmail: "",
  supportPhone: "",
  liveChatTelegram: "",
  weekdayHours: "",
  saturdayHours: "",
  sundayHours: "",
  timezone: "Asia/Yangon (UTC+06:30)",
  reportFormEnabled: false,
  reportCategories: [],
  allowScreenshotAttachments: false,
}

type SectionContentMap = {
  about_us: AboutUsContent
  follow_us: FollowUsContent
  help_support: HelpSupportContent
}

const SECTION_DEFAULTS: SectionContentMap = {
  about_us: DEFAULT_ABOUT_US_CONTENT,
  follow_us: DEFAULT_FOLLOW_US_CONTENT,
  help_support: DEFAULT_HELP_SUPPORT_CONTENT,
}

type RawSectionRow = {
  section: AppContentSectionName
  draftContent: unknown
  publishedContent: unknown
  hasUnpublishedChanges: boolean
  updatedAt: Date | null
  updatedByName: string | null
  publishedAt: Date | null
  publishedByName: string | null
}

function toRow<K extends AppContentSectionName>(
  section: K,
  raw: RawSectionRow | undefined
): AppContentSectionRow<SectionContentMap[K]> {
  if (!raw) {
    return {
      draftContent: SECTION_DEFAULTS[section],
      publishedContent: null,
      hasUnpublishedChanges: false,
      updatedAt: null,
      updatedByName: null,
      publishedAt: null,
      publishedByName: null,
    }
  }
  return {
    draftContent: raw.draftContent as SectionContentMap[K],
    publishedContent: (raw.publishedContent as SectionContentMap[K] | null) ?? null,
    hasUnpublishedChanges: raw.hasUnpublishedChanges,
    updatedAt: raw.updatedAt,
    updatedByName: raw.updatedByName,
    publishedAt: raw.publishedAt,
    publishedByName: raw.publishedByName,
  }
}

export async function getAppContentSections(): Promise<AppContentSections> {
  const rows = (await db.select().from(appContentSection)) as RawSectionRow[]
  const bySection = new Map(rows.map((r) => [r.section, r]))
  return {
    aboutUs: toRow("about_us", bySection.get("about_us")),
    followUs: toRow("follow_us", bySection.get("follow_us")),
    helpSupport: toRow("help_support", bySection.get("help_support")),
  }
}

export async function saveAppContentDraft(input: {
  aboutUs?: AboutUsContent
  followUs?: FollowUsContent
  helpSupport?: HelpSupportContent
  updatedByName: string
}): Promise<void> {
  const entries: Array<[AppContentSectionName, unknown]> = []
  if (input.aboutUs) entries.push(["about_us", input.aboutUs])
  if (input.followUs) entries.push(["follow_us", input.followUs])
  if (input.helpSupport) entries.push(["help_support", input.helpSupport])
  if (entries.length === 0) return

  await db.transaction(async (tx) => {
    for (const [section, content] of entries) {
      await tx
        .insert(appContentSection)
        .values({
          section,
          draftContent: content,
          hasUnpublishedChanges: true,
          updatedByName: input.updatedByName,
        })
        .onConflictDoUpdate({
          target: appContentSection.section,
          set: {
            draftContent: content,
            hasUnpublishedChanges: true,
            updatedByName: input.updatedByName,
            updatedAt: new Date(),
          },
        })
    }
  })
}

export async function publishAppContentSections(
  publishedByName: string
): Promise<{ published: AppContentSectionName[] }> {
  return db.transaction(async (tx) => {
    const rows = (await tx
      .select()
      .from(appContentSection)
      .where(eq(appContentSection.hasUnpublishedChanges, true))) as Array<
      RawSectionRow & { id: string }
    >
    const published: AppContentSectionName[] = []
    for (const row of rows) {
      await tx
        .update(appContentSection)
        .set({
          publishedContent: row.draftContent,
          hasUnpublishedChanges: false,
          publishedAt: new Date(),
          publishedByName,
        })
        .where(eq(appContentSection.id, row.id))
      published.push(row.section)
    }
    return { published }
  })
}

async function getPublishedContent<K extends AppContentSectionName>(
  section: K
): Promise<SectionContentMap[K]> {
  const [row] = await db
    .select({ publishedContent: appContentSection.publishedContent })
    .from(appContentSection)
    .where(eq(appContentSection.section, section))
    .limit(1)
  return (row?.publishedContent as SectionContentMap[K] | undefined) ?? SECTION_DEFAULTS[section]
}

export function getPublishedAboutUs(): Promise<AboutUsContent> {
  return getPublishedContent("about_us")
}

export function getPublishedFollowUs(): Promise<FollowUsContent> {
  return getPublishedContent("follow_us")
}

export function getPublishedHelpSupport(): Promise<HelpSupportContent> {
  return getPublishedContent("help_support")
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/app-content-db.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Write the cache layer (no separate test — thin wrapper, exercised indirectly by Task 7's mobile route tests)**

Create `features/app-content/db/cache/app-content.ts`:

```ts
import { cacheTag, updateTag } from "next/cache"
import { getGlobalTag } from "@/lib/dataCache"
import {
  getPublishedAboutUs,
  getPublishedFollowUs,
  getPublishedHelpSupport,
} from "@/features/app-content/db/app-content"
import type {
  AboutUsContent,
  FollowUsContent,
  HelpSupportContent,
} from "@/features/app-content/schemas/app-content"

function getAppContentGlobalTag() {
  return getGlobalTag("appContent")
}

export async function getCachedPublishedAboutUs(): Promise<AboutUsContent> {
  "use cache"
  cacheTag(getAppContentGlobalTag())
  return getPublishedAboutUs()
}

export async function getCachedPublishedFollowUs(): Promise<FollowUsContent> {
  "use cache"
  cacheTag(getAppContentGlobalTag())
  return getPublishedFollowUs()
}

export async function getCachedPublishedHelpSupport(): Promise<HelpSupportContent> {
  "use cache"
  cacheTag(getAppContentGlobalTag())
  return getPublishedHelpSupport()
}

export function revalidateAppContentCache(): void {
  updateTag(getAppContentGlobalTag())
}
```

- [ ] **Step 6: Commit**

```bash
git add features/app-content/db/app-content.ts features/app-content/db/cache/app-content.ts tests/unit/app-content-db.test.ts
git commit -m "feat: add app-content db layer with draft/publish semantics"
```

---

### Task 4: RBAC feature key + permission predicate

**Files:**
- Modify: `features/rbac/feature-keys.ts`
- Create: `features/app-content/permissions/app-content.ts`

**Interfaces:**
- Produces: `FEATURE_KEYS.SETTINGS_APP_CONTENT` — consumed by Task 9 (page guard) and Task 12 (sidebar nav).
- Produces: `canManageAppContent(role: string): boolean` — consumed by Task 5 (actions).

- [ ] **Step 1: Add the feature key and group entry**

In `features/rbac/feature-keys.ts`, add to `FEATURE_KEYS`:

```ts
  SETTINGS_ESCROW:           "settings.escrow",
  SETTINGS_APP_CONTENT:      "settings.app_content",
} as const
```

And add to the `"Settings"` group in `FEATURE_GROUPS`:

```ts
  {
    label: "Settings",
    features: [
      { key: FEATURE_KEYS.SETTINGS_RATING_TAGS,     label: "Seller Rating Tags" },
      { key: FEATURE_KEYS.SETTINGS_PRECAUTION_TAGS, label: "Precaution Tags" },
      { key: FEATURE_KEYS.SETTINGS_ESCROW,          label: "Settings" },
      { key: FEATURE_KEYS.SETTINGS_APP_CONTENT,     label: "App Content" },
    ],
  },
```

- [ ] **Step 2: Create the permission predicate**

Create `features/app-content/permissions/app-content.ts`:

```ts
export function canManageAppContent(role: string) {
  return role === "admin"
}
```

- [ ] **Step 3: Verify the project type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add features/rbac/feature-keys.ts features/app-content/permissions/app-content.ts
git commit -m "feat: add SETTINGS_APP_CONTENT feature key and permission predicate"
```

---

### Task 5: Server Actions (save + publish)

**Files:**
- Create: `features/app-content/actions/app-content.ts`
- Test: `tests/unit/app-content-actions.test.ts`

**Interfaces:**
- Consumes: `saveAppContentSchema`, `SaveAppContentInput` (Task 2); `saveAppContentDraft`, `publishAppContentSections` (Task 3); `revalidateAppContentCache` (Task 3); `canManageAppContent` (Task 4); `requireActionRole` (`lib/action-guard.ts`); `zodErrorMessage` (`lib/form-data.ts`).
- Produces: `saveAppContentAction(input: SaveAppContentInput): Promise<{ success: true } | { error: string }>`; `publishAppContentAction(): Promise<{ success: true; published: string[] } | { error: string }>` — consumed by Task 9's `AppContentClient`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/app-content-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { saveAppContentAction, publishAppContentAction } from "@/features/app-content/actions/app-content"
import { requireActionRole } from "@/lib/action-guard"
import { saveAppContentDraft, publishAppContentSections } from "@/features/app-content/db/app-content"
import { revalidateAppContentCache } from "@/features/app-content/db/cache/app-content"
import { DEFAULT_ABOUT_US_CONTENT } from "@/features/app-content/db/app-content"

vi.mock("@/lib/action-guard", () => ({ requireActionRole: vi.fn() }))
vi.mock("@/features/app-content/db/app-content", async () => {
  const actual = await vi.importActual<typeof import("@/features/app-content/db/app-content")>(
    "@/features/app-content/db/app-content"
  )
  return {
    ...actual,
    saveAppContentDraft: vi.fn(),
    publishAppContentSections: vi.fn(),
  }
})
vi.mock("@/features/app-content/db/cache/app-content", () => ({
  revalidateAppContentCache: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireActionRole).mockResolvedValue({ user: { id: "admin-1", name: "Elena M." } } as never)
})

describe("saveAppContentAction", () => {
  it("saves the provided section and returns success", async () => {
    vi.mocked(saveAppContentDraft).mockResolvedValue(undefined)
    const result = await saveAppContentAction({ aboutUs: DEFAULT_ABOUT_US_CONTENT })
    expect(result).toEqual({ success: true })
    expect(saveAppContentDraft).toHaveBeenCalledWith({
      aboutUs: DEFAULT_ABOUT_US_CONTENT,
      followUs: undefined,
      helpSupport: undefined,
      updatedByName: "Elena M.",
    })
  })

  it("returns an error when no section is provided", async () => {
    const result = await saveAppContentAction({})
    expect(result).toEqual({ error: "Nothing to save" })
    expect(saveAppContentDraft).not.toHaveBeenCalled()
  })

  it("returns an error for invalid content", async () => {
    const result = await saveAppContentAction({
      aboutUs: { ...DEFAULT_ABOUT_US_CONTENT, storyHeading: "" },
    })
    expect(result).toHaveProperty("error")
    expect(saveAppContentDraft).not.toHaveBeenCalled()
  })

  it("returns Unauthorized when the session check fails", async () => {
    vi.mocked(requireActionRole).mockResolvedValue(null as never)
    const result = await saveAppContentAction({ aboutUs: DEFAULT_ABOUT_US_CONTENT })
    expect(result).toEqual({ error: "Unauthorized" })
    expect(saveAppContentDraft).not.toHaveBeenCalled()
  })
})

describe("publishAppContentAction", () => {
  it("publishes and revalidates the cache", async () => {
    vi.mocked(publishAppContentSections).mockResolvedValue({ published: ["about_us"] })
    const result = await publishAppContentAction()
    expect(result).toEqual({ success: true, published: ["about_us"] })
    expect(revalidateAppContentCache).toHaveBeenCalled()
  })

  it("returns an error when nothing is pending", async () => {
    vi.mocked(publishAppContentSections).mockResolvedValue({ published: [] })
    const result = await publishAppContentAction()
    expect(result).toEqual({ error: "Nothing to publish" })
    expect(revalidateAppContentCache).not.toHaveBeenCalled()
  })

  it("returns Unauthorized when the session check fails", async () => {
    vi.mocked(requireActionRole).mockResolvedValue(null as never)
    const result = await publishAppContentAction()
    expect(result).toEqual({ error: "Unauthorized" })
    expect(publishAppContentSections).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/app-content-actions.test.ts`
Expected: FAIL — `Cannot find module '@/features/app-content/actions/app-content'`

- [ ] **Step 3: Write the actions implementation**

Create `features/app-content/actions/app-content.ts`:

```ts
"use server"

import { requireActionRole } from "@/lib/action-guard"
import { canManageAppContent } from "@/features/app-content/permissions/app-content"
import { saveAppContentSchema, type SaveAppContentInput } from "@/features/app-content/schemas/app-content"
import { saveAppContentDraft, publishAppContentSections } from "@/features/app-content/db/app-content"
import { revalidateAppContentCache } from "@/features/app-content/db/cache/app-content"
import { zodErrorMessage } from "@/lib/form-data"

export async function saveAppContentAction(input: SaveAppContentInput) {
  const parsed = saveAppContentSchema.safeParse(input)
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) }
  }
  if (!parsed.data.aboutUs && !parsed.data.followUs && !parsed.data.helpSupport) {
    return { error: "Nothing to save" }
  }
  const session = await requireActionRole(canManageAppContent)
  if (!session) {
    return { error: "Unauthorized" }
  }
  await saveAppContentDraft({
    aboutUs: parsed.data.aboutUs,
    followUs: parsed.data.followUs,
    helpSupport: parsed.data.helpSupport,
    updatedByName: session.user.name ?? session.user.email ?? "Admin",
  })
  return { success: true as const }
}

export async function publishAppContentAction() {
  const session = await requireActionRole(canManageAppContent)
  if (!session) {
    return { error: "Unauthorized" }
  }
  const { published } = await publishAppContentSections(
    session.user.name ?? session.user.email ?? "Admin"
  )
  if (published.length === 0) {
    return { error: "Nothing to publish" }
  }
  revalidateAppContentCache()
  return { success: true as const, published }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/app-content-actions.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add features/app-content/actions/app-content.ts tests/unit/app-content-actions.test.ts
git commit -m "feat: add saveAppContentAction and publishAppContentAction"
```

---

### Task 6: Reorder helper

**Files:**
- Create: `features/app-content/lib/reorder.ts`
- Test: `tests/unit/app-content-reorder.test.ts`

**Interfaces:**
- Produces: `reorderBySortOrder<T extends { id: string; sortOrder: number }>(items: T[], activeId: string, overId: string): T[]` — consumed by Task 9's `SortableList` component.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/app-content-reorder.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { reorderBySortOrder } from "@/features/app-content/lib/reorder"

type Item = { id: string; sortOrder: number }

const ITEMS: Item[] = [
  { id: "a", sortOrder: 0 },
  { id: "b", sortOrder: 1 },
  { id: "c", sortOrder: 2 },
]

describe("reorderBySortOrder", () => {
  it("moves an item from the front to the back and recomputes sortOrder", () => {
    const result = reorderBySortOrder(ITEMS, "a", "c")
    expect(result.map((i) => i.id)).toEqual(["b", "c", "a"])
    expect(result.map((i) => i.sortOrder)).toEqual([0, 1, 2])
  })

  it("moves an item from the back to the front", () => {
    const result = reorderBySortOrder(ITEMS, "c", "a")
    expect(result.map((i) => i.id)).toEqual(["c", "a", "b"])
  })

  it("returns the input unchanged when activeId equals overId", () => {
    const result = reorderBySortOrder(ITEMS, "a", "a")
    expect(result).toEqual(ITEMS)
  })

  it("returns the input unchanged when activeId is not found", () => {
    const result = reorderBySortOrder(ITEMS, "missing", "a")
    expect(result).toEqual(ITEMS)
  })

  it("returns the input unchanged when overId is not found", () => {
    const result = reorderBySortOrder(ITEMS, "a", "missing")
    expect(result).toEqual(ITEMS)
  })

  it("sorts by existing sortOrder before reordering, regardless of input array order", () => {
    const shuffled: Item[] = [
      { id: "c", sortOrder: 2 },
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 1 },
    ]
    const result = reorderBySortOrder(shuffled, "a", "c")
    expect(result.map((i) => i.id)).toEqual(["b", "c", "a"])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/app-content-reorder.test.ts`
Expected: FAIL — `Cannot find module '@/features/app-content/lib/reorder'`

- [ ] **Step 3: Write the implementation**

Create `features/app-content/lib/reorder.ts`:

```ts
/**
 * Recompute sortOrder after dragging `activeId` to where `overId` currently sits.
 * Sorts by existing sortOrder first so callers can pass items in any array order.
 */
export function reorderBySortOrder<T extends { id: string; sortOrder: number }>(
  items: T[],
  activeId: string,
  overId: string
): T[] {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder)
  const oldIndex = sorted.findIndex((i) => i.id === activeId)
  const newIndex = sorted.findIndex((i) => i.id === overId)
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return items

  const moved = [...sorted]
  const [item] = moved.splice(oldIndex, 1)
  moved.splice(newIndex, 0, item)
  return moved.map((it, idx) => ({ ...it, sortOrder: idx }))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/app-content-reorder.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add features/app-content/lib/reorder.ts tests/unit/app-content-reorder.test.ts
git commit -m "feat: add reorderBySortOrder helper for drag-to-reorder lists"
```

---

### Task 7: Mobile API routes

**Files:**
- Create: `app/api/mobile/about-us/route.ts`
- Create: `app/api/mobile/follow-us/route.ts`
- Create: `app/api/mobile/help-support/route.ts`
- Test: `tests/api/mobile/about-us.test.ts`
- Test: `tests/api/mobile/follow-us.test.ts`
- Test: `tests/api/mobile/help-support.test.ts`

**Interfaces:**
- Consumes: `getCachedPublishedAboutUs/FollowUs/HelpSupport` (Task 3); `jsonCached`, `jsonError` (`lib/api.ts`).

- [ ] **Step 1: Write the failing tests**

Create `tests/api/mobile/about-us.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET } from "@/app/api/mobile/about-us/route"
import { getCachedPublishedAboutUs } from "@/features/app-content/db/cache/app-content"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/app-content/db/cache/app-content", () => ({
  getCachedPublishedAboutUs: vi.fn(),
}))

describe("GET /api/mobile/about-us", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
  })

  it("returns the published about-us content with cache headers", async () => {
    vi.mocked(getCachedPublishedAboutUs).mockResolvedValue({
      storyHeading: "Our Story",
      storyBody: "GemX began in 2019.",
      termsSlug: "terms",
      termsUpdatedAt: null,
      privacySlug: "privacy",
      privacyUpdatedAt: null,
      companyName: "GemX Technologies Ltd.",
      contactAddress: "Yangon, Myanmar",
      appVersion: "v2.4.1",
    })
    const req = new Request("http://localhost/api/mobile/about-us")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toContain("public")
    const body = await res.json()
    expect(body).toMatchObject({ storyHeading: "Our Story", companyName: "GemX Technologies Ltd." })
  })

  it("returns 500 when the db layer throws", async () => {
    vi.mocked(getCachedPublishedAboutUs).mockRejectedValue(new Error("db down"))
    const req = new Request("http://localhost/api/mobile/about-us")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(500)
  })
})
```

Create `tests/api/mobile/follow-us.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET } from "@/app/api/mobile/follow-us/route"
import { getCachedPublishedFollowUs } from "@/features/app-content/db/cache/app-content"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/app-content/db/cache/app-content", () => ({
  getCachedPublishedFollowUs: vi.fn(),
}))

const PLATFORM_ACTIVE = {
  id: "p1",
  iconKey: "facebook",
  customIconUrl: null,
  label: "Facebook",
  value: "facebook.com/gemx.app",
  url: "https://facebook.com/gemx.app",
  isActive: true,
  sortOrder: 1,
}
const PLATFORM_HIDDEN = {
  id: "p2",
  iconKey: "tiktok",
  customIconUrl: null,
  label: "TikTok",
  value: "@gemx",
  url: "https://tiktok.com/@gemx",
  isActive: false,
  sortOrder: 0,
}

describe("GET /api/mobile/follow-us", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
  })

  it("returns only active platforms, sorted by sortOrder", async () => {
    vi.mocked(getCachedPublishedFollowUs).mockResolvedValue({
      platforms: [PLATFORM_ACTIVE, PLATFORM_HIDDEN],
    })
    const req = new Request("http://localhost/api/mobile/follow-us")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.platforms).toHaveLength(1)
    expect(body.platforms[0]).toMatchObject({ label: "Facebook" })
  })

  it("returns an empty list when never published", async () => {
    vi.mocked(getCachedPublishedFollowUs).mockResolvedValue({ platforms: [] })
    const req = new Request("http://localhost/api/mobile/follow-us")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    expect((await res.json()).platforms).toEqual([])
  })
})
```

Create `tests/api/mobile/help-support.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET } from "@/app/api/mobile/help-support/route"
import { getCachedPublishedHelpSupport } from "@/features/app-content/db/cache/app-content"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/app-content/db/cache/app-content", () => ({
  getCachedPublishedHelpSupport: vi.fn(),
}))

const FAQ_ACTIVE = { id: "f1", question: "Q1", answer: "A1", isActive: true, sortOrder: 1 }
const FAQ_HIDDEN = { id: "f2", question: "Q2", answer: "A2", isActive: false, sortOrder: 0 }

describe("GET /api/mobile/help-support", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
  })

  it("returns only active FAQs sorted by sortOrder, plus contact/hours/reportForm", async () => {
    vi.mocked(getCachedPublishedHelpSupport).mockResolvedValue({
      faqs: [FAQ_ACTIVE, FAQ_HIDDEN],
      supportEmail: "support@gemx.app",
      supportPhone: "+95 9 250 000 111",
      liveChatTelegram: "t.me/gemxsupport",
      weekdayHours: "9:00–18:00",
      saturdayHours: "10:00–15:00",
      sundayHours: "Closed",
      timezone: "Asia/Yangon (UTC+06:30)",
      reportFormEnabled: true,
      reportCategories: ["Bug", "Payment"],
      allowScreenshotAttachments: true,
    })
    const req = new Request("http://localhost/api/mobile/help-support")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.faqs).toHaveLength(1)
    expect(body.faqs[0]).toMatchObject({ question: "Q1" })
    expect(body.contact).toMatchObject({ email: "support@gemx.app" })
    expect(body.hours).toMatchObject({ weekday: "9:00–18:00", timezone: "Asia/Yangon (UTC+06:30)" })
    expect(body.reportForm).toMatchObject({ enabled: true, categories: ["Bug", "Payment"] })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/api/mobile/about-us.test.ts tests/api/mobile/follow-us.test.ts tests/api/mobile/help-support.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/mobile/about-us/route'` (and similarly for the other two)

- [ ] **Step 3: Write the route implementations**

Create `app/api/mobile/about-us/route.ts`:

```ts
import { NextRequest, connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getCachedPublishedAboutUs } from "@/features/app-content/db/cache/app-content"

/** Public read-only About Us content for the mobile app. No auth required. */
export async function GET(_request: NextRequest) {
  await connection()
  try {
    const content = await getCachedPublishedAboutUs()
    return jsonCached(content)
  } catch (e) {
    console.error("GET /api/mobile/about-us:", e)
    return jsonError("Failed to load about us content", 500)
  }
}
```

Create `app/api/mobile/follow-us/route.ts`:

```ts
import { NextRequest, connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getCachedPublishedFollowUs } from "@/features/app-content/db/cache/app-content"

/** Public read-only Follow Us platform list for the mobile app. No auth required. */
export async function GET(_request: NextRequest) {
  await connection()
  try {
    const { platforms } = await getCachedPublishedFollowUs()
    const active = platforms
      .filter((p) => p.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ iconKey, customIconUrl, label, value, url }) => ({
        iconKey,
        customIconUrl,
        label,
        value,
        url,
      }))
    return jsonCached({ platforms: active })
  } catch (e) {
    console.error("GET /api/mobile/follow-us:", e)
    return jsonError("Failed to load follow us content", 500)
  }
}
```

Create `app/api/mobile/help-support/route.ts`:

```ts
import { NextRequest, connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getCachedPublishedHelpSupport } from "@/features/app-content/db/cache/app-content"

/** Public read-only Help & Support content for the mobile app. No auth required. */
export async function GET(_request: NextRequest) {
  await connection()
  try {
    const content = await getCachedPublishedHelpSupport()
    const activeFaqs = content.faqs
      .filter((f) => f.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ question, answer }) => ({ question, answer }))

    return jsonCached({
      faqs: activeFaqs,
      contact: {
        email: content.supportEmail,
        phone: content.supportPhone,
        telegram: content.liveChatTelegram,
      },
      hours: {
        weekday: content.weekdayHours,
        saturday: content.saturdayHours,
        sunday: content.sundayHours,
        timezone: content.timezone,
      },
      reportForm: {
        enabled: content.reportFormEnabled,
        categories: content.reportCategories,
        allowScreenshots: content.allowScreenshotAttachments,
      },
    })
  } catch (e) {
    console.error("GET /api/mobile/help-support:", e)
    return jsonError("Failed to load help & support content", 500)
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/api/mobile/about-us.test.ts tests/api/mobile/follow-us.test.ts tests/api/mobile/help-support.test.ts`
Expected: PASS (7 tests total)

- [ ] **Step 5: Commit**

```bash
git add app/api/mobile/about-us app/api/mobile/follow-us app/api/mobile/help-support tests/api/mobile/about-us.test.ts tests/api/mobile/follow-us.test.ts tests/api/mobile/help-support.test.ts
git commit -m "feat: add public mobile GET endpoints for app content"
```

---

### Task 8: Custom icon upload Server Action

This feature has no `app/api/admin/*` routes anywhere else — the icon upload is a
Server Action too, not a REST route, even though the two other upload-style routes
this codebase has (`certificate`, `kyc-document`, etc.) are all `app/api/upload/*`.
Those exist for buyer/seller-facing uploads reachable from many places; this one
exists solely to serve the App Content admin page, so it follows this feature's own
convention instead.

**Files:**
- Modify: `lib/supabase/server.ts`
- Create: `features/app-content/actions/app-content-icon.ts`
- Test: `tests/unit/app-content-icon-action.test.ts`

**Interfaces:**
- Consumes: `canManageAppContent` (Task 4), `requireActionRole` (`lib/action-guard.ts`), `getSupabaseAdmin`/`getSupabaseAdminErrorMessage` and the new `APP_CONTENT_ICONS_BUCKET` (`lib/supabase/server.ts`), `validateUploadFile`/`storageObjectPath`/`uploadFileToBucket` (`lib/supabase/storage-upload.ts`).
- Produces: `uploadAppContentIconAction(formData: FormData): Promise<{ url: string } | { error: string }>` — consumed by Task 11's `FollowUsTab`.

- [ ] **Step 1: Add the bucket constant**

In `lib/supabase/server.ts`, add after `KYC_DOCUMENTS_BUCKET`:

```ts
/** Bucket for custom Follow Us platform icons (public for direct links). */
export const APP_CONTENT_ICONS_BUCKET = "app-content-icons"
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/app-content-icon-action.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { uploadAppContentIconAction } from "@/features/app-content/actions/app-content-icon"
import { requireActionRole } from "@/lib/action-guard"
import { getSupabaseAdmin, getSupabaseAdminErrorMessage } from "@/lib/supabase/server"
import { validateUploadFile, storageObjectPath, uploadFileToBucket } from "@/lib/supabase/storage-upload"

vi.mock("@/lib/action-guard", () => ({ requireActionRole: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({
  APP_CONTENT_ICONS_BUCKET: "app-content-icons",
  getSupabaseAdmin: vi.fn(),
  getSupabaseAdminErrorMessage: vi.fn().mockReturnValue("Supabase upload not configured."),
}))
vi.mock("@/lib/supabase/storage-upload", () => ({
  validateUploadFile: vi.fn(),
  storageObjectPath: vi.fn().mockReturnValue("admin-1/abc.png"),
  uploadFileToBucket: vi.fn(),
}))

function fd(file?: File): FormData {
  const f = new FormData()
  if (file) f.set("file", file)
  return f
}

const PNG = new File(["x"], "icon.png", { type: "image/png" })

describe("uploadAppContentIconAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireActionRole).mockResolvedValue({ user: { id: "admin-1" } } as never)
    vi.mocked(validateUploadFile).mockResolvedValue(null)
    vi.mocked(getSupabaseAdmin).mockReturnValue({} as never)
    vi.mocked(uploadFileToBucket).mockResolvedValue({
      url: "https://example.com/app-content-icons/admin-1/abc.png",
    })
  })

  it("returns Unauthorized when the session check fails", async () => {
    vi.mocked(requireActionRole).mockResolvedValue(null as never)
    const result = await uploadAppContentIconAction(fd(PNG))
    expect(result).toEqual({ error: "Unauthorized" })
    expect(uploadFileToBucket).not.toHaveBeenCalled()
  })

  it("returns an error when no file is provided", async () => {
    const result = await uploadAppContentIconAction(fd())
    expect(result).toEqual({ error: "No file provided" })
  })

  it("returns an error when the file fails validation", async () => {
    vi.mocked(validateUploadFile).mockResolvedValue(
      Response.json({ error: "Invalid file type" }, { status: 400 })
    )
    const result = await uploadAppContentIconAction(fd(PNG))
    expect(result).toEqual({ error: "Invalid file type" })
    expect(uploadFileToBucket).not.toHaveBeenCalled()
  })

  it("returns an error when Supabase admin is not configured", async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(null)
    const result = await uploadAppContentIconAction(fd(PNG))
    expect(result).toEqual({ error: "Supabase upload not configured." })
  })

  it("returns the url on a successful upload", async () => {
    const result = await uploadAppContentIconAction(fd(PNG))
    expect(result).toEqual({ url: "https://example.com/app-content-icons/admin-1/abc.png" })
    expect(uploadFileToBucket).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ bucket: "app-content-icons", path: "admin-1/abc.png", file: PNG })
    )
  })

  it("returns an error when the storage upload itself fails", async () => {
    vi.mocked(uploadFileToBucket).mockResolvedValue({
      error: Response.json({ error: "Upload failed" }, { status: 500 }),
    })
    const result = await uploadAppContentIconAction(fd(PNG))
    expect(result).toEqual({ error: "Upload failed" })
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/unit/app-content-icon-action.test.ts`
Expected: FAIL — `Cannot find module '@/features/app-content/actions/app-content-icon'`

- [ ] **Step 4: Write the Server Action**

Create `features/app-content/actions/app-content-icon.ts`:

```ts
"use server"

import { requireActionRole } from "@/lib/action-guard"
import { canManageAppContent } from "@/features/app-content/permissions/app-content"
import {
  APP_CONTENT_ICONS_BUCKET,
  getSupabaseAdmin,
  getSupabaseAdminErrorMessage,
} from "@/lib/supabase/server"
import {
  storageObjectPath,
  uploadFileToBucket,
  validateUploadFile,
} from "@/lib/supabase/storage-upload"

const ALLOWED_ICON_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_ICON_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB

async function errorMessageFrom(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json()
    return typeof body?.error === "string" ? body.error : fallback
  } catch {
    return fallback
  }
}

/** Uploads a custom Follow Us platform icon. Admin only. */
export async function uploadAppContentIconAction(
  formData: FormData
): Promise<{ url: string } | { error: string }> {
  const session = await requireActionRole(canManageAppContent)
  if (!session) return { error: "Unauthorized" }

  const file = formData.get("file")
  if (!(file instanceof File)) return { error: "No file provided" }

  const invalidResponse = await validateUploadFile(file, ALLOWED_ICON_TYPES, MAX_ICON_SIZE_BYTES)
  if (invalidResponse) return { error: await errorMessageFrom(invalidResponse, "Invalid file") }

  const supabase = getSupabaseAdmin()
  if (!supabase) return { error: getSupabaseAdminErrorMessage() }

  const result = await uploadFileToBucket(supabase, {
    bucket: APP_CONTENT_ICONS_BUCKET,
    path: storageObjectPath(session.user.id, file, "png"),
    file,
    createBucketIfMissing: true,
  })
  if (result.error) return { error: await errorMessageFrom(result.error, "Upload failed") }

  return { url: result.url }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/app-content-icon-action.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Verify the project type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add lib/supabase/server.ts features/app-content/actions/app-content-icon.ts tests/unit/app-content-icon-action.test.ts
git commit -m "feat: add admin-only uploadAppContentIconAction for custom Follow Us icons"
```

---

### Task 9: Reusable UI pieces — SortableList, PlatformIcon, and stylesheet

**Files:**
- Create: `features/app-content/components/SortableList.tsx`
- Create: `features/app-content/components/PlatformIcon.tsx`
- Create: `app/admin/app-content/app-content.css`

**Interfaces:**
- Consumes: `reorderBySortOrder` (Task 6).
- Produces: `<SortableList items renderRow onReorder />` generic component — consumed by Tasks 11-12. `<PlatformIcon iconKey customIconUrl size />` — consumed by Tasks 11-12. CSS classes prefixed `ac-*` — consumed by Tasks 10-12.

- [ ] **Step 1: Create the stylesheet**

Create `app/admin/app-content/app-content.css`:

```css
.ac-wrap {
  --ac-green: #2ba25f;
  --ac-green-d: #1f8a4f;
  --ac-green-soft: #e9f5ee;
  --ac-bd: #e6ebe7;
  --ac-ink: #18211c;
  --ac-muted: #78847c;
  --ac-muted2: #aab3ac;
  --ac-amber: #f59e0b;
  color: var(--ac-ink);
}

.ac-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border: 1px solid var(--ac-bd);
  border-radius: 16px;
  padding: 14px 20px;
  margin-bottom: 18px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
  gap: 12px;
  flex-wrap: wrap;
}

.ac-crumb {
  display: flex;
  align-items: center;
  gap: 10px;
  font: 600 13px "Plus Jakarta Sans", system-ui, sans-serif;
  color: var(--ac-muted);
}

.ac-crumb b {
  color: var(--ac-ink);
}

.ac-unsaved-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #fff5e6;
  color: #b06f00;
  font: 600 12px "Plus Jakarta Sans", system-ui, sans-serif;
}

.ac-unsaved-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ac-amber);
}

.ac-topbar-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ac-note {
  font: 500 12px "Plus Jakarta Sans", system-ui, sans-serif;
  color: var(--ac-muted2);
}

.ac-btn {
  border: 1px solid var(--ac-bd);
  background: #fff;
  color: var(--ac-ink);
  font: 600 13.5px "Plus Jakarta Sans", system-ui, sans-serif;
  padding: 9px 16px;
  border-radius: 10px;
  cursor: pointer;
}

.ac-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ac-btn-primary {
  border: none;
  background: var(--ac-green);
  color: #fff;
  box-shadow: 0 2px 6px rgba(43, 162, 95, 0.35);
}

.ac-tabs {
  display: flex;
  background: #eaeeeb;
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 22px;
  max-width: 520px;
}

.ac-tab {
  flex: 1;
  border: none;
  background: none;
  padding: 10px;
  border-radius: 9px;
  font: 700 13.5px "Plus Jakarta Sans", system-ui, sans-serif;
  color: var(--ac-muted);
  cursor: pointer;
}

.ac-tab.active {
  background: #fff;
  color: var(--ac-ink);
  box-shadow: 0 1px 3px rgba(16, 24, 40, 0.12);
}

.ac-card {
  background: #fff;
  border: 1px solid var(--ac-bd);
  border-radius: 16px;
  padding: 22px;
  margin-bottom: 16px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}

.ac-cardhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  gap: 12px;
}

.ac-cardhead b {
  font: 700 15px "Plus Jakarta Sans", system-ui, sans-serif;
}

.ac-label {
  font: 600 11px "Plus Jakarta Sans", system-ui, sans-serif;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--ac-muted);
  margin-bottom: 8px;
}

.ac-input,
.ac-textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--ac-bd);
  border-radius: 10px;
  padding: 11px 13px;
  font: 500 14px "Plus Jakarta Sans", system-ui, sans-serif;
  color: var(--ac-ink);
  background: #fff;
  margin-bottom: 14px;
}

.ac-textarea {
  resize: none;
}

.ac-2col {
  display: flex;
  gap: 16px;
}

.ac-2col > div {
  flex: 1;
  min-width: 0;
}

.ac-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 4px;
  border-top: 1px solid var(--ac-bd);
}

.ac-row:first-of-type {
  border-top: none;
}

.ac-draghandle {
  color: var(--ac-muted2);
  cursor: grab;
  display: inline-flex;
  touch-action: none;
}

.ac-icon {
  border-radius: 9px;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font: 800 12px "Plus Jakarta Sans", system-ui, sans-serif;
}

.ac-addbtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--ac-bd);
  background: #fff;
  color: var(--ac-ink);
  font: 700 13px "Plus Jakarta Sans", system-ui, sans-serif;
  padding: 9px 14px;
  border-radius: 10px;
  cursor: pointer;
}

.ac-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 8px;
  background: var(--ac-green-soft);
  color: var(--ac-green-d);
  font: 600 12px "Plus Jakarta Sans", system-ui, sans-serif;
  margin: 0 6px 6px 0;
}

.ac-chip button {
  border: none;
  background: none;
  color: inherit;
  opacity: 0.6;
  cursor: pointer;
  padding: 0;
}
```

- [ ] **Step 2: Create SortableList**

Create `features/app-content/components/SortableList.tsx`:

```tsx
"use client"

import type { ReactNode } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { reorderBySortOrder } from "@/features/app-content/lib/reorder"

export type SortableItem = { id: string; sortOrder: number }

type Props<T extends SortableItem> = {
  items: T[]
  onReorder: (items: T[]) => void
  renderRow: (item: T, index: number) => ReactNode
}

export function SortableList<T extends SortableItem>({ items, onReorder, renderRow }: Props<T>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const moved = reorderBySortOrder(sorted, String(active.id), String(over.id))
    if (moved !== sorted) onReorder(moved)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sorted.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {sorted.map((item, index) => (
          <SortableRow key={item.id} id={item.id}>
            {renderRow(item, index)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className="ac-row">
      <span className="ac-draghandle" {...attributes} {...listeners}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </span>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Create PlatformIcon**

Create `features/app-content/components/PlatformIcon.tsx`:

```tsx
type Props = {
  iconKey: string
  customIconUrl?: string | null
  size?: number
}

const ICON_BG: Record<string, string> = {
  facebook: "#1877f2",
  instagram: "linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)",
  telegram: "#29a9eb",
  tiktok: "#000000",
  viber: "#7360f2",
  custom: "#78847c",
}

const ICON_GLYPH: Record<string, string> = {
  facebook: "f",
  instagram: "IG",
  telegram: "TG",
  tiktok: "TT",
  viber: "V",
}

export function PlatformIcon({ iconKey, customIconUrl, size = 38 }: Props) {
  if (iconKey === "custom" && customIconUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a static asset
    return (
      <img
        src={customIconUrl}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
      />
    )
  }
  return (
    <span
      className="ac-icon"
      style={{ width: size, height: size, background: ICON_BG[iconKey] ?? ICON_BG.custom }}
    >
      {ICON_GLYPH[iconKey] ?? "?"}
    </span>
  )
}
```

- [ ] **Step 4: Verify the project type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add features/app-content/components/SortableList.tsx features/app-content/components/PlatformIcon.tsx app/admin/app-content/app-content.css
git commit -m "feat: add SortableList, PlatformIcon, and app-content stylesheet"
```

---

### Task 10: Admin page shell + AppContentClient + sidebar nav

**Files:**
- Create: `app/admin/app-content/page.tsx`
- Create: `features/app-content/components/AppContentClient.tsx`
- Create: `features/app-content/components/AboutUsTab.tsx` (stub — filled in fully by Task 11; here it renders the section's raw fields minimally so the page compiles end-to-end)
- Modify: `components/admin/AdminSidebar.tsx`

**Interfaces:**
- Consumes: `getAppContentSections` (Task 3); `requireFeatureAccess` (`lib/admin-guard.ts`); `FEATURE_KEYS.SETTINGS_APP_CONTENT` (Task 4); `saveAppContentAction`, `publishAppContentAction` (Task 5); `AboutUsContent`, `FollowUsContent`, `HelpSupportContent` (Task 2).
- Produces: `<AppContentClient />` — the shared shell that Tasks 11-12 will plug `FollowUsTab`/`HelpSupportTab` into (this task wires `AboutUsTab` only; Tasks 11-12 add the other two imports).

- [ ] **Step 1: Create a minimal AboutUsTab (fleshed out fully in Task 11's neighbor, Task 12 covers Help; this task needs *a* working About Us tab so the page renders end-to-end for manual testing)**

Create `features/app-content/components/AboutUsTab.tsx`:

```tsx
"use client"

import type { AboutUsContent } from "@/features/app-content/schemas/app-content"

type Props = {
  value: AboutUsContent
  onChange: (value: AboutUsContent) => void
}

function todayIso(): string {
  return new Date().toISOString()
}

export function AboutUsTab({ value, onChange }: Props) {
  function set<K extends keyof AboutUsContent>(key: K, next: AboutUsContent[K]) {
    onChange({ ...value, [key]: next })
  }

  return (
    <div>
      <div className="ac-card">
        <div className="ac-cardhead"><b>Our story</b></div>
        <div className="ac-label">Section heading</div>
        <input
          className="ac-input"
          value={value.storyHeading}
          onChange={(e) => set("storyHeading", e.target.value)}
        />
        <div className="ac-label">Story</div>
        <textarea
          className="ac-textarea"
          style={{ height: 120 }}
          value={value.storyBody}
          onChange={(e) => set("storyBody", e.target.value)}
        />
      </div>

      <div className="ac-2col">
        <div className="ac-card">
          <div className="ac-cardhead">
            <b>Terms of Service</b>
            <span className="ac-note">
              {value.termsUpdatedAt ? `Updated ${new Date(value.termsUpdatedAt).toLocaleDateString()}` : "Not set"}
            </span>
          </div>
          <div className="ac-label">Slug (gemx.app/…)</div>
          <input
            className="ac-input"
            value={value.termsSlug}
            onChange={(e) => onChange({ ...value, termsSlug: e.target.value, termsUpdatedAt: todayIso() })}
          />
        </div>
        <div className="ac-card">
          <div className="ac-cardhead">
            <b>Privacy Policy</b>
            <span className="ac-note">
              {value.privacyUpdatedAt ? `Updated ${new Date(value.privacyUpdatedAt).toLocaleDateString()}` : "Not set"}
            </span>
          </div>
          <div className="ac-label">Slug (gemx.app/…)</div>
          <input
            className="ac-input"
            value={value.privacySlug}
            onChange={(e) => onChange({ ...value, privacySlug: e.target.value, privacyUpdatedAt: todayIso() })}
          />
        </div>
      </div>

      <div className="ac-card">
        <div className="ac-cardhead"><b>Company &amp; version</b></div>
        <div className="ac-2col">
          <div>
            <div className="ac-label">Company name</div>
            <input
              className="ac-input"
              value={value.companyName}
              onChange={(e) => set("companyName", e.target.value)}
            />
          </div>
          <div>
            <div className="ac-label">App version</div>
            <input
              className="ac-input"
              value={value.appVersion}
              onChange={(e) => set("appVersion", e.target.value)}
              placeholder="e.g. v2.4.1"
            />
          </div>
        </div>
        <div className="ac-label">Contact address</div>
        <textarea
          className="ac-textarea"
          style={{ height: 56 }}
          value={value.contactAddress}
          onChange={(e) => set("contactAddress", e.target.value)}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create placeholder-free stand-in tabs for Follow Us and Help & Support (real implementations land in Tasks 11-12; these compile and render the raw section so the page works today)**

Create `features/app-content/components/FollowUsTab.tsx`:

```tsx
"use client"

import type { FollowUsContent } from "@/features/app-content/schemas/app-content"

type Props = {
  value: FollowUsContent
  onChange: (value: FollowUsContent) => void
}

export function FollowUsTab({ value }: Props) {
  return (
    <div className="ac-card">
      <div className="ac-cardhead"><b>Social platforms</b></div>
      <div className="ac-note">{value.platforms.length} platform(s) configured.</div>
    </div>
  )
}
```

Create `features/app-content/components/HelpSupportTab.tsx`:

```tsx
"use client"

import type { HelpSupportContent } from "@/features/app-content/schemas/app-content"

type Props = {
  value: HelpSupportContent
  onChange: (value: HelpSupportContent) => void
}

export function HelpSupportTab({ value }: Props) {
  return (
    <div className="ac-card">
      <div className="ac-cardhead"><b>FAQs</b></div>
      <div className="ac-note">{value.faqs.length} FAQ(s) configured.</div>
    </div>
  )
}
```

(Task 11 replaces `FollowUsTab.tsx` with the full drag-to-reorder + icon-picker implementation; Task 12 replaces `HelpSupportTab.tsx` with the full FAQ list + contact/hours/report cards. Both keep the exact same `Props` shape shown here, so `AppContentClient` never changes.)

- [ ] **Step 3: Create AppContentClient**

Create `features/app-content/components/AppContentClient.tsx`:

```tsx
"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  saveAppContentAction,
  publishAppContentAction,
} from "@/features/app-content/actions/app-content"
import type {
  AboutUsContent,
  FollowUsContent,
  HelpSupportContent,
} from "@/features/app-content/schemas/app-content"
import { AboutUsTab } from "@/features/app-content/components/AboutUsTab"
import { FollowUsTab } from "@/features/app-content/components/FollowUsTab"
import { HelpSupportTab } from "@/features/app-content/components/HelpSupportTab"

type TabId = "about" | "follow" | "help"

export type AppContentClientProps = {
  initialTab: TabId
  aboutUs: AboutUsContent
  followUs: FollowUsContent
  helpSupport: HelpSupportContent
  pendingPublish: { aboutUs: boolean; followUs: boolean; helpSupport: boolean }
  lastEditedAt: string | null
  lastEditedBy: string | null
  currentUserName: string
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "No edits yet"
  const diffSec = (Date.now() - new Date(iso).getTime()) / 1000
  if (diffSec < 60) return "just now"
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}

export function AppContentClient(props: AppContentClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [tab, setTab] = useState<TabId>(props.initialTab)
  const [aboutUs, setAboutUs] = useState(props.aboutUs)
  const [followUs, setFollowUs] = useState(props.followUs)
  const [helpSupport, setHelpSupport] = useState(props.helpSupport)
  const [savedAboutUs, setSavedAboutUs] = useState(props.aboutUs)
  const [savedFollowUs, setSavedFollowUs] = useState(props.followUs)
  const [savedHelpSupport, setSavedHelpSupport] = useState(props.helpSupport)
  const [pendingPublish, setPendingPublish] = useState(props.pendingPublish)
  const [lastEditedAt, setLastEditedAt] = useState(props.lastEditedAt)
  const [lastEditedBy, setLastEditedBy] = useState(props.lastEditedBy)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const dirty = useMemo(
    () => ({
      aboutUs: JSON.stringify(aboutUs) !== JSON.stringify(savedAboutUs),
      followUs: JSON.stringify(followUs) !== JSON.stringify(savedFollowUs),
      helpSupport: JSON.stringify(helpSupport) !== JSON.stringify(savedHelpSupport),
    }),
    [aboutUs, followUs, helpSupport, savedAboutUs, savedFollowUs, savedHelpSupport]
  )
  const isDirty = dirty.aboutUs || dirty.followUs || dirty.helpSupport
  const canPublish = pendingPublish.aboutUs || pendingPublish.followUs || pendingPublish.helpSupport

  function switchTab(next: TabId) {
    setTab(next)
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  async function handleSave() {
    if (!isDirty || saving) return
    setSaving(true)
    const result = await saveAppContentAction({
      aboutUs: dirty.aboutUs ? aboutUs : undefined,
      followUs: dirty.followUs ? followUs : undefined,
      helpSupport: dirty.helpSupport ? helpSupport : undefined,
    })
    setSaving(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    if (dirty.aboutUs) {
      setSavedAboutUs(aboutUs)
      setPendingPublish((p) => ({ ...p, aboutUs: true }))
    }
    if (dirty.followUs) {
      setSavedFollowUs(followUs)
      setPendingPublish((p) => ({ ...p, followUs: true }))
    }
    if (dirty.helpSupport) {
      setSavedHelpSupport(helpSupport)
      setPendingPublish((p) => ({ ...p, helpSupport: true }))
    }
    setLastEditedAt(new Date().toISOString())
    setLastEditedBy(props.currentUserName)
    toast.success("Draft saved")
  }

  async function handlePublish() {
    if (!canPublish || publishing) return
    setPublishing(true)
    const result = await publishAppContentAction()
    setPublishing(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setPendingPublish({ aboutUs: false, followUs: false, helpSupport: false })
    toast.success("Published to app")
  }

  return (
    <div className="ac-wrap">
      <div className="ac-topbar">
        <div className="ac-crumb">
          App <span>/</span> <b>About &amp; Support</b>
          {isDirty && (
            <span className="ac-unsaved-pill">
              <span className="ac-unsaved-dot" />
              Unsaved changes
            </span>
          )}
        </div>
        <div className="ac-topbar-actions">
          <span className="ac-note">
            {lastEditedAt
              ? `Edited ${fmtRelative(lastEditedAt)}${lastEditedBy ? ` · ${lastEditedBy}` : ""}`
              : "No edits yet"}
          </span>
          <button className="ac-btn" onClick={handleSave} disabled={!isDirty || saving}>
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            className="ac-btn ac-btn-primary"
            onClick={handlePublish}
            disabled={!canPublish || publishing}
          >
            {publishing ? "Publishing…" : "Publish to app"}
          </button>
        </div>
      </div>

      <div className="ac-tabs">
        <button className={`ac-tab${tab === "about" ? " active" : ""}`} onClick={() => switchTab("about")}>
          About us
        </button>
        <button className={`ac-tab${tab === "follow" ? " active" : ""}`} onClick={() => switchTab("follow")}>
          Follow us
        </button>
        <button className={`ac-tab${tab === "help" ? " active" : ""}`} onClick={() => switchTab("help")}>
          Help &amp; Support
        </button>
      </div>

      {tab === "about" && <AboutUsTab value={aboutUs} onChange={setAboutUs} />}
      {tab === "follow" && <FollowUsTab value={followUs} onChange={setFollowUs} />}
      {tab === "help" && <HelpSupportTab value={helpSupport} onChange={setHelpSupport} />}
    </div>
  )
}
```

- [ ] **Step 4: Create the page**

Create `app/admin/app-content/page.tsx`:

```tsx
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getAppContentSections } from "@/features/app-content/db/app-content"
import { AppContentClient } from "@/features/app-content/components/AppContentClient"
import "./app-content.css"

type TabId = "about" | "follow" | "help"
const TABS: TabId[] = ["about", "follow", "help"]

type Props = {
  searchParams: Promise<{ tab?: string }>
}

export default async function AppContentAdminPage({ searchParams }: Props) {
  await connection()
  const session = await requireFeatureAccess(FEATURE_KEYS.SETTINGS_APP_CONTENT)
  const params = await searchParams
  const tab: TabId = (TABS as readonly string[]).includes(params.tab ?? "")
    ? (params.tab as TabId)
    : "about"

  const sections = await getAppContentSections()

  const candidates: Array<{ at: Date | null; by: string | null }> = [
    { at: sections.aboutUs.updatedAt, by: sections.aboutUs.updatedByName },
    { at: sections.followUs.updatedAt, by: sections.followUs.updatedByName },
    { at: sections.helpSupport.updatedAt, by: sections.helpSupport.updatedByName },
  ]
  const latest = candidates
    .filter((c): c is { at: Date; by: string | null } => c.at !== null)
    .sort((a, b) => b.at.getTime() - a.at.getTime())[0]

  return (
    <AppContentClient
      initialTab={tab}
      aboutUs={sections.aboutUs.draftContent}
      followUs={sections.followUs.draftContent}
      helpSupport={sections.helpSupport.draftContent}
      pendingPublish={{
        aboutUs: sections.aboutUs.hasUnpublishedChanges,
        followUs: sections.followUs.hasUnpublishedChanges,
        helpSupport: sections.helpSupport.hasUnpublishedChanges,
      }}
      lastEditedAt={latest ? latest.at.toISOString() : null}
      lastEditedBy={latest?.by ?? null}
      currentUserName={session?.user.name ?? session?.user.email ?? "Admin"}
    />
  )
}
```

- [ ] **Step 5: Add the sidebar nav entry**

In `components/admin/AdminSidebar.tsx`, import `FileStack` (or another unused lucide icon — check the existing `lucide-react` import block; if `FileStack` isn't already imported elsewhere in this file, add it there) alongside the other icons, then add to the `"Settings"` group's `items` array, after the `SETTINGS_ESCROW` entry:

```tsx
      {
        href: "/admin/app-content",
        label: "App Content",
        icon: FileStack,
        color: "#0ea5e9",
        featureKey: FEATURE_KEYS.SETTINGS_APP_CONTENT,
        isActive: (p) => p.startsWith("/admin/app-content"),
      },
```

And add `FileStack` to the `lucide-react` import list at the top of the file (alongside `Palette`).

- [ ] **Step 6: Verify the project type-checks and the page renders**

Run: `npx tsc --noEmit`
Expected: no new errors.

Run: `npm run dev` (in a separate terminal, or use the `run` skill), then visit `http://localhost:3000/admin/app-content` while logged in as an admin.
Expected: the page loads, shows three tabs, About Us renders its form fields, Follow Us / Help & Support show a one-line placeholder count (to be replaced in Tasks 11-12). Clicking "Save draft" with an edited field succeeds and shows a "Draft saved" toast; "Publish to app" then succeeds and shows "Published to app".

- [ ] **Step 7: Commit**

```bash
git add app/admin/app-content/page.tsx features/app-content/components/AppContentClient.tsx features/app-content/components/AboutUsTab.tsx features/app-content/components/FollowUsTab.tsx features/app-content/components/HelpSupportTab.tsx components/admin/AdminSidebar.tsx
git commit -m "feat: add App Content admin page shell with About Us tab wired end-to-end"
```

---

### Task 11: Full Follow Us tab (drag-to-reorder + icon picker + upload)

**Files:**
- Modify: `features/app-content/components/FollowUsTab.tsx` (replaces the Task 10 stand-in; same `Props` shape, so `AppContentClient` needs no changes)

**Interfaces:**
- Consumes: `SortableList` (Task 9), `PlatformIcon` (Task 9), `SocialPlatform`/`FollowUsContent` (Task 2), `uploadAppContentIconAction` (Task 8).

- [ ] **Step 1: Replace FollowUsTab.tsx with the full implementation**

Replace the contents of `features/app-content/components/FollowUsTab.tsx`:

```tsx
"use client"

import { useRef, useState } from "react"
import type { FollowUsContent, SocialPlatform } from "@/features/app-content/schemas/app-content"
import { SortableList } from "@/features/app-content/components/SortableList"
import { PlatformIcon } from "@/features/app-content/components/PlatformIcon"
import { uploadAppContentIconAction } from "@/features/app-content/actions/app-content-icon"

type Props = {
  value: FollowUsContent
  onChange: (value: FollowUsContent) => void
}

const BUILTIN_ICONS = ["facebook", "instagram", "telegram", "tiktok", "viber"] as const

function newPlatformId(): string {
  return crypto.randomUUID()
}

export function FollowUsTab({ value, onChange }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [draftIconKey, setDraftIconKey] = useState<string>("facebook")
  const [draftCustomIconUrl, setDraftCustomIconUrl] = useState<string | null>(null)
  const [draftLabel, setDraftLabel] = useState("")
  const [draftValue, setDraftValue] = useState("")
  const [draftUrl, setDraftUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function updatePlatform(id: string, patch: Partial<SocialPlatform>) {
    onChange({
      platforms: value.platforms.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })
  }

  function removePlatform(id: string) {
    onChange({ platforms: value.platforms.filter((p) => p.id !== id) })
  }

  function reorderPlatforms(reordered: SocialPlatform[]) {
    const byId = new Map(reordered.map((p) => [p.id, p.sortOrder]))
    onChange({
      platforms: value.platforms.map((p) => ({ ...p, sortOrder: byId.get(p.id) ?? p.sortOrder })),
    })
  }

  async function handleIconUpload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set("file", file)
      const result = await uploadAppContentIconAction(formData)
      if ("error" in result) throw new Error(result.error)
      setDraftCustomIconUrl(result.url)
      setDraftIconKey("custom")
    } catch {
      // The button re-enables and the field stays empty; the admin can retry.
    } finally {
      setUploading(false)
    }
  }

  function resetDraft() {
    setDraftIconKey("facebook")
    setDraftCustomIconUrl(null)
    setDraftLabel("")
    setDraftValue("")
    setDraftUrl("")
    setShowAdd(false)
  }

  function addPlatform() {
    if (!draftLabel.trim() || !draftValue.trim() || !draftUrl.trim()) return
    const nextSortOrder = value.platforms.length
      ? Math.max(...value.platforms.map((p) => p.sortOrder)) + 1
      : 0
    const platform: SocialPlatform = {
      id: newPlatformId(),
      iconKey: draftIconKey as SocialPlatform["iconKey"],
      customIconUrl: draftIconKey === "custom" ? draftCustomIconUrl : null,
      label: draftLabel.trim(),
      value: draftValue.trim(),
      url: draftUrl.trim(),
      isActive: true,
      sortOrder: nextSortOrder,
    }
    onChange({ platforms: [...value.platforms, platform] })
    resetDraft()
  }

  return (
    <div>
      <div className="ac-card">
        <div className="ac-cardhead">
          <div>
            <b>Social platforms</b>
            <div className="ac-note">Drag to reorder. Hidden platforms disappear from the app.</div>
          </div>
          <button className="ac-addbtn" onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? "Cancel" : "+ Add platform"}
          </button>
        </div>

        <SortableList
          items={value.platforms}
          onReorder={reorderPlatforms}
          renderRow={(platform) => (
            <>
              <PlatformIcon iconKey={platform.iconKey} customIconUrl={platform.customIconUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "700 14px 'Plus Jakarta Sans', system-ui, sans-serif" }}>
                  {platform.label}
                </div>
                <input
                  className="ac-input"
                  style={{ border: "none", padding: "2px 0 0", margin: 0, background: "none" }}
                  value={platform.value}
                  onChange={(e) => updatePlatform(platform.id, { value: e.target.value })}
                />
              </div>
              <button
                onClick={() => removePlatform(platform.id)}
                className="ac-btn"
                style={{ padding: "6px 10px" }}
                aria-label={`Remove ${platform.label}`}
              >
                Delete
              </button>
              <div
                role="switch"
                aria-checked={platform.isActive}
                tabIndex={0}
                onClick={() => updatePlatform(platform.id, { isActive: !platform.isActive })}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault()
                    updatePlatform(platform.id, { isActive: !platform.isActive })
                  }
                }}
                style={{
                  width: 38,
                  height: 22,
                  borderRadius: 999,
                  background: platform.isActive ? "var(--ac-green)" : "#d7ddd8",
                  position: "relative",
                  flexShrink: 0,
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: platform.isActive ? 18 : 2,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left .18s",
                  }}
                />
              </div>
            </>
          )}
        />
      </div>

      {showAdd && (
        <div className="ac-card" style={{ borderStyle: "dashed" }}>
          <div className="ac-cardhead"><b>Add platform</b></div>
          <div className="ac-label">Icon</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {BUILTIN_ICONS.map((key) => (
              <button
                key={key}
                onClick={() => { setDraftIconKey(key); setDraftCustomIconUrl(null) }}
                style={{
                  border: draftIconKey === key ? "2px solid var(--ac-green)" : "2px solid transparent",
                  borderRadius: 11,
                  padding: 0,
                  background: "none",
                  cursor: "pointer",
                }}
                aria-label={key}
              >
                <PlatformIcon iconKey={key} />
              </button>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="ac-btn"
              style={{ padding: "6px 10px" }}
            >
              {uploading ? "Uploading…" : draftIconKey === "custom" ? "Change custom icon" : "Upload custom icon"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleIconUpload(file)
              }}
            />
          </div>
          <div className="ac-label">Label</div>
          <input className="ac-input" value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} placeholder="e.g. Facebook" />
          <div className="ac-label">Display value</div>
          <input className="ac-input" value={draftValue} onChange={(e) => setDraftValue(e.target.value)} placeholder="e.g. facebook.com/gemx.app" />
          <div className="ac-label">Link URL</div>
          <input className="ac-input" value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} placeholder="https://…" />
          <button className="ac-btn ac-btn-primary" onClick={addPlatform}>Add</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify the project type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual check**

Run the dev server, open `/admin/app-content?tab=follow`. Add a platform with a built-in icon, drag rows to reorder, toggle a row inactive, delete a row. Save draft, then Publish, and confirm `curl http://localhost:3000/api/mobile/follow-us` reflects only active platforms in the new order.

- [ ] **Step 4: Commit**

```bash
git add features/app-content/components/FollowUsTab.tsx
git commit -m "feat: implement Follow Us tab with drag-to-reorder and icon picker"
```

---

### Task 12: Full Help & Support tab (FAQ list + contact/hours/report cards)

**Files:**
- Modify: `features/app-content/components/HelpSupportTab.tsx` (replaces the Task 10 stand-in; same `Props` shape)

**Interfaces:**
- Consumes: `SortableList` (Task 9), `FaqItem`/`HelpSupportContent` (Task 2).

- [ ] **Step 1: Replace HelpSupportTab.tsx with the full implementation**

Replace the contents of `features/app-content/components/HelpSupportTab.tsx`:

```tsx
"use client"

import { useState } from "react"
import type { FaqItem, HelpSupportContent } from "@/features/app-content/schemas/app-content"
import { SortableList } from "@/features/app-content/components/SortableList"

type Props = {
  value: HelpSupportContent
  onChange: (value: HelpSupportContent) => void
}

function newFaqId(): string {
  return crypto.randomUUID()
}

export function HelpSupportTab({ value, onChange }: Props) {
  const [newCategory, setNewCategory] = useState("")
  const [showAddFaq, setShowAddFaq] = useState(false)
  const [draftQuestion, setDraftQuestion] = useState("")
  const [draftAnswer, setDraftAnswer] = useState("")

  function set<K extends keyof HelpSupportContent>(key: K, next: HelpSupportContent[K]) {
    onChange({ ...value, [key]: next })
  }

  function updateFaq(id: string, patch: Partial<FaqItem>) {
    onChange({ ...value, faqs: value.faqs.map((f) => (f.id === id ? { ...f, ...patch } : f)) })
  }

  function removeFaq(id: string) {
    onChange({ ...value, faqs: value.faqs.filter((f) => f.id !== id) })
  }

  function reorderFaqs(reordered: FaqItem[]) {
    const byId = new Map(reordered.map((f) => [f.id, f.sortOrder]))
    onChange({ ...value, faqs: value.faqs.map((f) => ({ ...f, sortOrder: byId.get(f.id) ?? f.sortOrder })) })
  }

  function addFaq() {
    if (!draftQuestion.trim() || !draftAnswer.trim()) return
    const nextSortOrder = value.faqs.length ? Math.max(...value.faqs.map((f) => f.sortOrder)) + 1 : 0
    const faq: FaqItem = {
      id: newFaqId(),
      question: draftQuestion.trim(),
      answer: draftAnswer.trim(),
      isActive: true,
      sortOrder: nextSortOrder,
    }
    onChange({ ...value, faqs: [...value.faqs, faq] })
    setDraftQuestion("")
    setDraftAnswer("")
    setShowAddFaq(false)
  }

  function addCategory() {
    const trimmed = newCategory.trim()
    if (!trimmed || value.reportCategories.includes(trimmed)) return
    set("reportCategories", [...value.reportCategories, trimmed])
    setNewCategory("")
  }

  function removeCategory(cat: string) {
    set("reportCategories", value.reportCategories.filter((c) => c !== cat))
  }

  return (
    <div>
      <div className="ac-card">
        <div className="ac-cardhead">
          <div>
            <b>FAQs</b>
            <div className="ac-note">Drag to reorder · toggle to show or hide.</div>
          </div>
          <button className="ac-addbtn" onClick={() => setShowAddFaq((s) => !s)}>
            {showAddFaq ? "Cancel" : "+ Add FAQ"}
          </button>
        </div>

        {showAddFaq && (
          <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--ac-bd)" }}>
            <input
              className="ac-input"
              placeholder="Question"
              value={draftQuestion}
              onChange={(e) => setDraftQuestion(e.target.value)}
            />
            <textarea
              className="ac-textarea"
              style={{ height: 70 }}
              placeholder="Answer"
              value={draftAnswer}
              onChange={(e) => setDraftAnswer(e.target.value)}
            />
            <button className="ac-btn ac-btn-primary" onClick={addFaq}>Add FAQ</button>
          </div>
        )}

        <SortableList
          items={value.faqs}
          onReorder={reorderFaqs}
          renderRow={(faq) => (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  className="ac-input"
                  style={{ marginBottom: 6, fontWeight: 700 }}
                  value={faq.question}
                  onChange={(e) => updateFaq(faq.id, { question: e.target.value })}
                />
                <textarea
                  className="ac-textarea"
                  style={{ height: 50, marginBottom: 0 }}
                  value={faq.answer}
                  onChange={(e) => updateFaq(faq.id, { answer: e.target.value })}
                />
              </div>
              <button
                onClick={() => removeFaq(faq.id)}
                className="ac-btn"
                style={{ padding: "6px 10px" }}
                aria-label="Delete FAQ"
              >
                Delete
              </button>
              <div
                role="switch"
                aria-checked={faq.isActive}
                tabIndex={0}
                onClick={() => updateFaq(faq.id, { isActive: !faq.isActive })}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault()
                    updateFaq(faq.id, { isActive: !faq.isActive })
                  }
                }}
                style={{
                  width: 38,
                  height: 22,
                  borderRadius: 999,
                  background: faq.isActive ? "var(--ac-green)" : "#d7ddd8",
                  position: "relative",
                  flexShrink: 0,
                  cursor: "pointer",
                  alignSelf: "flex-start",
                  marginTop: 8,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: faq.isActive ? 18 : 2,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left .18s",
                  }}
                />
              </div>
            </>
          )}
        />
      </div>

      <div className="ac-2col">
        <div className="ac-card">
          <div className="ac-cardhead"><b>Contact channels</b></div>
          <div className="ac-label">Support email</div>
          <input className="ac-input" value={value.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} />
          <div className="ac-label">Phone</div>
          <input className="ac-input" value={value.supportPhone} onChange={(e) => set("supportPhone", e.target.value)} />
          <div className="ac-label">Live chat (Telegram)</div>
          <input className="ac-input" value={value.liveChatTelegram} onChange={(e) => set("liveChatTelegram", e.target.value)} />
        </div>

        <div>
          <div className="ac-card">
            <div className="ac-cardhead"><b>Operating hours</b></div>
            <div className="ac-label">Mon – Fri</div>
            <input className="ac-input" value={value.weekdayHours} onChange={(e) => set("weekdayHours", e.target.value)} />
            <div className="ac-label">Saturday</div>
            <input className="ac-input" value={value.saturdayHours} onChange={(e) => set("saturdayHours", e.target.value)} />
            <div className="ac-label">Sunday</div>
            <input className="ac-input" value={value.sundayHours} onChange={(e) => set("sundayHours", e.target.value)} />
            <div className="ac-label">Timezone</div>
            <input className="ac-input" value={value.timezone} onChange={(e) => set("timezone", e.target.value)} />
          </div>

          <div className="ac-card">
            <div className="ac-cardhead">
              <b>Report a problem</b>
              <div
                role="switch"
                aria-checked={value.reportFormEnabled}
                tabIndex={0}
                onClick={() => set("reportFormEnabled", !value.reportFormEnabled)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault()
                    set("reportFormEnabled", !value.reportFormEnabled)
                  }
                }}
                style={{
                  width: 38,
                  height: 22,
                  borderRadius: 999,
                  background: value.reportFormEnabled ? "var(--ac-green)" : "#d7ddd8",
                  position: "relative",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: value.reportFormEnabled ? 18 : 2,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left .18s",
                  }}
                />
              </div>
            </div>
            <div className="ac-label">Categories</div>
            <div style={{ marginBottom: 10 }}>
              {value.reportCategories.map((cat) => (
                <span key={cat} className="ac-chip">
                  {cat}
                  <button onClick={() => removeCategory(cat)} aria-label={`Remove ${cat}`}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="ac-input"
                style={{ marginBottom: 0 }}
                placeholder="New category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCategory() }}
              />
              <button className="ac-btn" onClick={addCategory}>Add</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
              <span style={{ font: "600 13px 'Plus Jakarta Sans', system-ui, sans-serif" }}>
                Allow screenshot attachments
              </span>
              <div
                role="switch"
                aria-checked={value.allowScreenshotAttachments}
                tabIndex={0}
                onClick={() => set("allowScreenshotAttachments", !value.allowScreenshotAttachments)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault()
                    set("allowScreenshotAttachments", !value.allowScreenshotAttachments)
                  }
                }}
                style={{
                  width: 38,
                  height: 22,
                  borderRadius: 999,
                  background: value.allowScreenshotAttachments ? "var(--ac-green)" : "#d7ddd8",
                  position: "relative",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: value.allowScreenshotAttachments ? 18 : 2,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left .18s",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the project type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual check**

Run the dev server, open `/admin/app-content?tab=help`. Add an FAQ, reorder via drag, toggle visibility, add/remove a report category, toggle report form + screenshot switches. Save draft, then Publish, and confirm `curl http://localhost:3000/api/mobile/help-support` reflects only active FAQs and the current contact/hours/report config.

- [ ] **Step 4: Commit**

```bash
git add features/app-content/components/HelpSupportTab.tsx
git commit -m "feat: implement Help & Support tab with FAQ drag-to-reorder and report config"
```

---

### Task 13: Documentation

**Files:**
- Create: `docs/technical/app-content-admin.md`
- Create: `docs/guides/app-content-admin.md`
- Create: `docs/api/mobile-about-us.md`
- Create: `docs/api/mobile-follow-us.md`
- Create: `docs/api/mobile-help-support.md`
- Modify: `docs/MOBILE-API.md`

Per this repo's CLAUDE.md "After Every Change" rule, this task produces the four required doc types for the whole feature (technical, guide, and API docs — the collaborator guide and technical doc cover the feature as a whole rather than per-task since it was built across Tasks 1-12).

- [ ] **Step 1: Write the technical doc**

Create `docs/technical/app-content-admin.md`:

```markdown
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
```

- [ ] **Step 2: Write the collaborator guide**

Create `docs/guides/app-content-admin.md`:

```markdown
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
```

- [ ] **Step 3: Write the API docs**

Create `docs/api/mobile-about-us.md`:

```markdown
# GET /api/mobile/about-us

**Auth:** Public — no session required.

**Request:** No params.

**Response (200):**

```json
{
  "storyHeading": "Our Story",
  "storyBody": "GemX began in 2019...",
  "termsSlug": "terms",
  "termsUpdatedAt": "2026-03-12T00:00:00.000Z",
  "privacySlug": "privacy",
  "privacyUpdatedAt": "2026-03-12T00:00:00.000Z",
  "companyName": "GemX Technologies Ltd.",
  "contactAddress": "No. 12, Kabar Aye Pagoda Road, Yangon, Myanmar",
  "appVersion": "v2.4.1"
}
```

If the section has never been published, all string fields are empty and the `*UpdatedAt` fields are `null` — the response is still `200`.

**Errors:** `500` on an unexpected DB error, `{ "error": "Failed to load about us content" }`.

**Example:**

```bash
curl https://gemx.app/api/mobile/about-us
```

**Mobile flag:** Yes — consumed by the mobile app's About screen.
```

Create `docs/api/mobile-follow-us.md`:

```markdown
# GET /api/mobile/follow-us

**Auth:** Public — no session required.

**Request:** No params.

**Response (200):**

```json
{
  "platforms": [
    {
      "iconKey": "facebook",
      "customIconUrl": null,
      "label": "Facebook",
      "value": "facebook.com/gemx.app",
      "url": "https://facebook.com/gemx.app"
    }
  ]
}
```

Only platforms with `isActive: true` in the published content are returned, sorted by `sortOrder`. Empty array if never published or nothing is active.

**Errors:** `500` on an unexpected DB error, `{ "error": "Failed to load follow us content" }`.

**Example:**

```bash
curl https://gemx.app/api/mobile/follow-us
```

**Mobile flag:** Yes — consumed by the mobile app's Follow Us screen.
```

Create `docs/api/mobile-help-support.md`:

```markdown
# GET /api/mobile/help-support

**Auth:** Public — no session required.

**Request:** No params.

**Response (200):**

```json
{
  "faqs": [{ "question": "How do I sell an item on GemX?", "answer": "Tap the + button..." }],
  "contact": { "email": "support@gemx.app", "phone": "+95 9 250 000 111", "telegram": "t.me/gemxsupport" },
  "hours": { "weekday": "9:00–18:00", "saturday": "10:00–15:00", "sunday": "Closed", "timezone": "Asia/Yangon (UTC+06:30)" },
  "reportForm": { "enabled": true, "categories": ["Bug", "Payment", "Fraud"], "allowScreenshots": true }
}
```

Only FAQs with `isActive: true` are returned, sorted by `sortOrder`.

**Errors:** `500` on an unexpected DB error, `{ "error": "Failed to load help & support content" }`.

**Example:**

```bash
curl https://gemx.app/api/mobile/help-support
```

**Mobile flag:** Yes — consumed by the mobile app's Help & Support screen.
```

- [ ] **Step 4: Update the mobile API contract doc**

Read `docs/MOBILE-API.md` to find its section-numbering convention, then add a new top-level section documenting the three new endpoints (mirroring whatever level of detail existing sections use — endpoint, auth, response shape, one line of context). Reference the three files created in Step 3 rather than duplicating their full content.

- [ ] **Step 5: Run the full test suite one last time**

Run: `npm run test`
Expected: all tests pass, including the new `app-content-*` and mobile `about-us`/`follow-us`/`help-support` test files.

- [ ] **Step 6: Commit**

```bash
git add docs/technical/app-content-admin.md docs/guides/app-content-admin.md docs/api/mobile-about-us.md docs/api/mobile-follow-us.md docs/api/mobile-help-support.md docs/MOBILE-API.md
git commit -m "docs: document App Content admin feature and its three mobile endpoints"
```

---

## Self-Review Notes

- **Spec coverage**: every section of the design spec (architecture, data model, draft/publish workflow, admin UI per tab, mobile API responses, testing, known limitations) maps to a task above. The migration-running constraint from user memory is called out explicitly in Global Constraints and Task 1 Step 7.
- **Type consistency checked**: `AboutUsContent`/`FollowUsContent`/`HelpSupportContent` (Task 2) flow unchanged through Task 3 (db), Task 5 (actions), Task 7 (mobile routes), and Tasks 10-12 (components) — same field names throughout. `reorderBySortOrder` (Task 6) is the one function both `SortableList` (Task 9) and its test rely on — no duplicate reimplementation. `AppContentClientProps` (Task 10) matches exactly what `page.tsx` passes.
- **No placeholders**: Task 10's stand-in `FollowUsTab`/`HelpSupportTab` are real, compiling, minimal implementations (not TODO stubs) that Tasks 11-12 fully replace — flagged explicitly in their step text so no implementer mistakes them for the final version.
- **Security fix during review**: Task 8's icon upload initially only checked `requireUploadContext` (any signed-in user), unlike every other write path in this feature which gates on `canManageAppContent` (admin only). Fixed to add the same role check plus an "Unauthorized" test case.
- **Consistency fix during review**: Task 8 was originally an `app/api/upload/*` route, inconsistent with this feature's "no `app/api/admin/*` routes" convention. Converted to `uploadAppContentIconAction`, a Server Action gated by `requireActionRole(canManageAppContent)` like `saveAppContentAction`/`publishAppContentAction` — Task 11's `FollowUsTab` now calls it directly instead of `fetch()`. Updated the File Structure list, Task 11's upload handler, and Task 13's technical doc/guide to match.
