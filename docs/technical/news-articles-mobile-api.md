# News & Articles Mobile API Redesign

**Date:** 2026-07-02
**Scope:** Extend the public news/articles APIs to power the mobile "News & Articles" screens (list with category chips, featured card, search, read time; detail with author, category badge, cover image).

## What Changed

| File | Change |
|------|--------|
| `drizzle/schema/news-schema.ts` | Added `author` (default `"Gem X Newsroom"`), `category` (default `"general"`), `cover_image` (nullable), `is_featured` (default `false`) |
| `drizzle/schema/articles-schema.ts` | Added `category`, `cover_image`, `is_featured` (articles already had `author`) |
| `lib/read-time.ts` | **New.** Extracts plain text from BlockNote JSON and estimates read time at 200 wpm (min 1 minute) |
| `features/news/db/news.ts` | `getNewsPaginatedFromDb` gained `search` / `category` / `featured` filters and a `sort: "publish"` mode; new `getNewsCategoryCountsFromDb()` |
| `features/articles/db/articles.ts` | Same additions for articles (`getArticleCategoryCountsFromDb()`) |
| `features/news/schemas/news.ts` | New `CONTENT_CATEGORIES` enum + `contentCategorySchema`; create/update schemas accept the new fields; new `newsListQuerySchema` |
| `features/articles/schemas/articles.ts` | Create/update schemas accept new fields; new `articleListQuerySchema` (reuses `contentCategorySchema` from the news feature) |
| `app/api/news/route.ts`, `app/api/articles/route.ts` | Query parsing via `parseQuery` + Zod; forwards filters; responses include per-item `readTime` and `categoryCounts`; list + counts queries run in `Promise.all` |
| `app/api/news/[id]/route.ts`, `app/api/articles/[id]/route.ts` | Detail responses include computed `readTime` |
| `features/news/actions/news.ts`, `features/articles/actions/articles.ts` | Create/update actions pass `author` (news), `category`, `coverImage`, `isFeatured` through to the db layer |
| `features/news/components/ContentMetaCard.tsx` | **New.** "Mobile display" side card shared by both admin forms: category select, 16:9 cover upload (via `POST /api/upload/product-media`, bearer token from `authClient.useSession()` — same flow as `BlockNoteEditor`), featured toggle. Emits hidden `category`/`coverImage`/`isFeatured` inputs |
| `features/news/components/NewsForm.tsx` | Renders `ContentMetaCard`; added an author byline input (default `"Gem X Newsroom"`) |
| `features/articles/components/ArticleForm.tsx` | Renders `ContentMetaCard` (author input already existed) |
| `features/news/components/NewsTable.tsx`, `features/articles/components/ArticlesTable.tsx` | Title cell shows the real cover thumbnail when set, a ★ marker for featured rows, and the category in the meta row |

## Data Flow

```
Drizzle schema (news / articles table)
  → features/<feature>/db/*.ts      (filtered, paginated queries + category counts)
  → app/api/<feature>/route.ts      (Zod query parsing, readTime computed per item)
  → mobile client                   (list screen: chips from categoryCounts, featured card via featured=true)
```

Read time is **computed at response time** from `content` (BlockNote JSON) — it is not stored. `lib/read-time.ts` walks `content`/`children`/`rows`/`cells` nodes collecting `text` values, then `ceil(words / 200)` with a 1-minute floor.

Public list feeds sort by `coalesce(publish, created_at) DESC` (`sort: "publish"`). Admin views keep the previous `updated_at DESC` ordering because admin pages call the db functions without `sort`.

## Schema Impact — Migration Required (manual)

Old shape: `news(id, title, content, status, publish, created_at, updated_at)`, `articles(id, title, slug, content, author, status, publish_date, created_at, updated_at)`.

New columns (all backfilled by defaults, no data rewrite needed):

```sql
ALTER TABLE "news"
  ADD COLUMN "author" text NOT NULL DEFAULT 'Gem X Newsroom',
  ADD COLUMN "category" text NOT NULL DEFAULT 'general',
  ADD COLUMN "cover_image" text,
  ADD COLUMN "is_featured" boolean NOT NULL DEFAULT false;

ALTER TABLE "articles"
  ADD COLUMN "category" text NOT NULL DEFAULT 'general',
  ADD COLUMN "cover_image" text,
  ADD COLUMN "is_featured" boolean NOT NULL DEFAULT false;
```

Per project convention, migrations are applied manually: run `npm run db:generate` to produce the migration from the updated schema files, review it against the SQL above, then apply it yourself.

## Auth & Permissions

- `GET /api/news`, `GET /api/articles` and both detail routes are **public** (published content only; drafts 404 on detail, list defaults to `status=published`).
- Responses use `jsonCached` (60s CDN + 300s SWR) — acceptable because content is public and non-personalized.
- Mutations remain admin-only server actions guarded by `requireActionRole(canAdminManageNews / canAdminManageArticles)`.

## Edge Cases & Known Limitations

- **Category enum:** `general | market | gemology | guides | product`. Invalid `category` query params fall back to "no filter" rather than erroring (`.catch(undefined)`).
- **Invalid query params never 400** — `parseQuery` falls back to schema defaults, matching the existing API convention.
- **`categoryCounts` counts published items only** and ignores the current search/featured filters (chips show totals, per the design).
- **Search** is a case-insensitive `ILIKE` on title only (not body content). Full-text search on BlockNote JSON would need the `scripts/` FTS approach if required later.
- **Admin forms:** both forms expose the new fields via the shared `ContentMetaCard`. The hidden `coverImage` input is always submitted, so saving a form with the cover removed clears the column (form state is authoritative). Cover uploads land in the product-media bucket. Auto-save covers title/content(/author) only — category, cover and featured save on explicit Save/Publish.
- **Bookmarks** are a client-side concern (no server persistence was added).
- The mobile "9 TOTAL" header combines both tabs; clients should sum `total` from both endpoints or use each tab's own `categoryCounts.all`.
