# Guide: News & Articles for the Mobile App

How to use and extend the news/articles content APIs that power the mobile "News & Articles" screens.

## Prerequisites

- `DATABASE_URL` configured (`.env.local`)
- The migration adding `author`/`category`/`cover_image`/`is_featured` applied (see `docs/technical/news-articles-mobile-api.md` — migrations are applied manually in this project)
- No extra dependencies

## Using the API end-to-end

**1. Build the list screen (per tab):**

```ts
// News tab — page of published news + chip counts in one call
const res = await fetch(`${BASE}/api/news?page=1&limit=20`);
const { news, total, categoryCounts } = await res.json();
// chips: All (categoryCounts.all), Market (categoryCounts.market), ...
```

**2. Fetch the featured hero card:**

```ts
const res = await fetch(`${BASE}/api/news?featured=true&limit=1`);
const { news: [featured] } = await res.json();
```

**3. Search + category filter (both tabs use the same params):**

```ts
await fetch(`${BASE}/api/articles?search=gemstone&category=gemology`);
```

**4. Detail screen:**

```ts
const res = await fetch(`${BASE}/api/news/${id}`);
const item = await res.json(); // item.readTime → "6 min", item.author, item.coverImage
```

`content` is BlockNote JSON — render it with a BlockNote-compatible renderer, or reuse the text extraction in [lib/read-time.ts](../../lib/read-time.ts) for excerpts.

**5. Authoring content:** use the admin panel (`/admin/news`, `/admin/articles`). Both editors have a **Mobile display** side card ([ContentMetaCard](../../features/news/components/ContentMetaCard.tsx)) with the category dropdown, a 16:9 cover image upload and the Featured toggle; the news editor also has an author byline input under the title. Programmatically, the server actions (`createNewsAction`, `updateArticleAction`, ...) accept `author` (news), `category`, `coverImage` and `isFeatured` form fields (send `isFeatured` as the string `"true"`/`"false"`).

## Extending

**Add a new category:**
1. Add the value to `CONTENT_CATEGORIES` in `features/news/schemas/news.ts` (shared by articles).
2. Nothing else — db columns are plain `text`, counts are grouped dynamically, and the mobile app can render the new chip from `categoryCounts`.

**Add a new field (e.g. `excerpt`):**
1. Add the column in `drizzle/schema/news-schema.ts` (and/or `articles-schema.ts`), run `npm run db:generate`, apply the migration manually.
2. Add it to the row type + `create/update` inputs in `features/<feature>/db/*.ts`.
3. Add it to the Zod create/update schemas in `features/<feature>/schemas/*.ts`.
4. Pass it through the actions in `features/<feature>/actions/*.ts`.
5. It is included in API responses automatically (`select()` returns all columns).

**Add a new list filter:**
1. Add the param to `newsListQuerySchema` / `articleListQuerySchema` (use `.catch()` so invalid input degrades instead of erroring).
2. Add the corresponding `filters.push(...)` clause in `getNewsPaginatedFromDb` / `getArticlesPaginatedFromDb`.
3. Forward it in the route handler.

## Common errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| `column "category" does not exist` | Migration not applied | Generate + apply the migration (manually, per project convention) |
| Filter param seems ignored | Invalid value (e.g. `category=sports`) | Invalid params intentionally fall back to defaults — check against `CONTENT_CATEGORIES` |
| Detail returns 404 for an existing row | Item is `draft` | Public endpoints only expose `published` content |
| `readTime` always 1 | `content` is empty/`[]` or not valid BlockNote JSON | Verify the editor saved BlockNote JSON into `content` |
| Stale data after publishing | CDN cache (60s) + SWR (300s) | Expected; wait out the TTL or serve behind `no-store` for previews |
