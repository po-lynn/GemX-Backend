# Search & Suggestions — Code Guide (Beginner-Friendly)

**When you change any search or suggestions code, update this doc.** It explains the three main pieces so you can review and understand them easily.

**Docs:** API contract and mobile UX → [MOBILE-API.md](./MOBILE-API.md) § 5.1.1, 5.1.2. Behaviour and ranking → [TECHNICAL-PRODUCTS.md](./TECHNICAL-PRODUCTS.md) § 1.5.

---

## The three pieces (overview)

| # | What | File | Lines |
|---|------|------|-------|
| **1** | Suggestions API | `app/api/products/suggestions/route.ts` | whole file |
| **2** | Shared and list search | `features/products/db/products.ts` | List search in `getAdminProductsFromDb`: **79–89** (search condition), **136–149** (order when searching). Helper `escapeLike`: **13–15**. |
| **3** | Suggestions query | `features/products/db/products.ts` | `getProductSearchSuggestions`: **259–303** |

---

## 1. `app/api/products/suggestions/route.ts`

**Purpose:** When the user types in the search box, the app calls this URL. We return a short list of product titles that match, so the app can show “Sapphire”, “Sapphire Ring”, etc.

| Line(s) | Code / idea | Explanation (beginner) |
|---------|-------------|-------------------------|
| 1–3 | Imports | We need Next.js request type and `connection()` (so this route is not pre-rendered), plus helpers to send JSON errors and cache headers. We call the DB function that does the actual suggestion lookup. |
| 5–7 | `MIN_QUERY_LENGTH`, `DEFAULT_LIMIT`, `MAX_LIMIT` | Constants: don’t search until the user typed at least 2 characters; by default return 5 suggestions, never more than 10. Keeps the API safe and fast. |
| 15–16 | `GET(request)` / `await connection()` | This function runs when someone does a GET to `/api/products/suggestions`. `connection()` tells Next.js this route needs the server (e.g. database), so it’s not cached as static HTML. |
| 17–18 | `try` / `searchParams` | We wrap the logic in try/catch so any error becomes a 500 response. We get the URL’s query string (everything after `?`). |
| 19 | `q = searchParams.get("q")?.trim() ?? ""` | Read the `q` parameter (what the user typed). Trim spaces; if there’s no `q`, use an empty string so we don’t pass `null` to the DB. |
| 20–22 | `limit` from query | Read `limit` from the URL. If the user sends a number, we clamp it between 1 and 10. If they don’t send it or send something invalid, we use 5. So the DB never gets a crazy limit. |
| 24–29 | `if (q.length < 2)` return `{ suggestions: [] }` | If the user typed fewer than 2 characters, we don’t hit the database. We just return an empty list and cache that response for a short time (30s). Saves work and keeps responses fast. |
| 31 | `getProductSearchSuggestions(q, limit)` | This is where we ask the database for matching product titles. The function lives in `features/products/db/products.ts`. |
| 32–35 | Return `{ suggestions }` with cache headers | We send back the list of suggestions and tell the browser/CDN they can cache this for 30 seconds (and 60s stale-while-revalidate). So the same search typed again is often served from cache. |
| 36–39 | `catch` / `jsonError(...)` | If anything throws (e.g. DB error), we log it and return a 500 with a simple error message. We use `jsonError` so the response is not cached (errors shouldn’t be cached). |

---

## 2. `features/products/db/products.ts` — shared and list search

**Purpose:** When someone calls GET /api/products with `?search=...`, we filter products by that term and sort so the best matches appear first. This is the **list search** logic in `getAdminProductsFromDb`.

**Lines:** Search condition **79–89**; sort order when searching **136–149**; helper `escapeLike` **13–15**.

### Helper: `escapeLike(s)` (lines 13–15)

| Line(s) | Code / idea | Explanation (beginner) |
|---------|-------------|-------------------------|
| 13–15 | `escapeLike(s)` | User input might contain `%` or `_`, which in SQL mean “any characters” or “one character”. We escape them (and backslash) so the user’s text is treated as literal text, not as wildcards. That keeps search safe and predictable. |

### List search in `getAdminProductsFromDb`: search condition (lines 79–89)

| Line(s) | Code / idea | Explanation (beginner) |
|---------|-------------|-------------------------|
| 79 | `search = opts.search?.trim()` | We take the search term from the options and trim spaces. If there’s no search, the rest of the search logic is skipped. |
| 81–89 | `searchCondition` with `or(...)` | When there *is* a search term, we build one big “OR” condition so a product matches if *any* of these is true: (1) **Full-text match**: Postgres looks at title + description with its search engine (stemming, word matching). (2) **Title contains** the term (case-insensitive, with `escapeLike` so `%`/`_` are safe). (3) **Seller name / phone / email contains** the term (same safe ILIKE). So we find products by product text or by seller. |
| 84 | `plainto_tsquery('english', search)` | This turns the user’s words into a Postgres full-text query. It handles multiple words and simple stemming (e.g. “sapphires” matches “sapphire”). The `search` value is passed as a parameter, so it’s safe from injection. |

### List search in `getAdminProductsFromDb`: sort order when searching (lines 136–149)

| Line(s) | Code / idea | Explanation (beginner) |
|---------|-------------|-------------------------|
| 136–149 | `orderByColumns` when `sortByPublicPriority` and `search` | For the public product list, we usually sort by “priority” (collector piece, then privilege assist, then featured, then newest). When the user *also* searched, we add **relevance** first: we use Postgres `ts_rank` so rows that match the search better appear at the top. Then we keep the same priority order (collector, privilege, featured, newest). So: “best text match first, then our business rules.” |

---

## 3. `features/products/db/products.ts` — `getProductSearchSuggestions`

**Purpose:** Return a short list of *distinct* product titles that match the user’s query, ordered so “Sapphire” appears before “Blue Sapphire” when they type “Sapph”.


**Lines:** **259–303** (type at 259; function 265–303).

| Line(s) | Code / idea | Explanation (beginner) |
|---------|-------------|-------------------------|
| 259 | `ProductSuggestionRow = { label: string }` | TypeScript type: each suggestion is an object with one field, `label` (the title string we show in the UI). |
| 265–267 | `getProductSearchSuggestions(q, limit = 5)` | Function that takes the search string `q` and an optional `limit` (default 5). Returns an array of `{ label: "..." }`. |
| 268–269 | `trimmed` / `if (trimmed.length < 2) return []` | We trim the query and, if it’s shorter than 2 characters, we return an empty array without touching the database. Avoids useless or noisy requests. |
| 270 | `cap = Math.min(Math.max(limit, 1), 10)` | We force `limit` to be between 1 and 10. So even if the API passed a wrong number, we never ask for more than 10 or less than 1. |
| 271–273 | `escaped`, `patternContains`, `patternStarts` | We escape the query for safe ILIKE, then build two patterns: one for “title contains query” (`%query%`) and one for “title starts with query” (`query%`). Used in the WHERE and ORDER BY. |
| 276–279 | `.select({ title, createdAt })` / `.from(product)` | We only need the product’s title and creation date. We don’t select description, price, etc., so the query stays small and fast. |
| 281–286 | `.where(and(eq(status, "active"), title ILIKE patternContains))` | We only suggest titles from products that are **active** and whose **title contains** the (escaped) query. So hidden/sold products don’t appear in suggestions. |
| 287–291 | `.orderBy(...)` | We sort so that (1) titles that **start with** the query come first, (2) then titles that only **contain** the query, (3) then newest first. So “Sapph” shows “Sapphire” before “Blue Sapphire”. |
| 292 | `.limit(50)` | We ask the database for at most 50 rows. We’ll then remove duplicate titles and only return up to `cap` (e.g. 10) to the client. Fetching 50 gives us enough to fill the list after deduplication. |
| 294–302 | `seen` Set, loop, `out.push`, `break` | We walk through the rows in order. If we’ve already added that title, we skip it (so we only show each distinct title once). We push `{ label: row.title }` until we have `cap` suggestions, then stop. |
| 303 | `return out` | Return the list of suggestion objects to the route handler, which sends it as `{ suggestions: out }` in the API response. |

---

## Quick reference table

| # | File | Function / export | Responsibility |
|---|------|-------------------|-----------------|
| 1 | `app/api/products/suggestions/route.ts` | `GET` | Parse `q` and `limit`, validate, call DB, return JSON with cache headers. |
| 2 | `features/products/db/products.ts` | `escapeLike(s)` (13–15) | Escape `\`, `%`, `_` for safe ILIKE. |
| 2 | `features/products/db/products.ts` | `getAdminProductsFromDb` — list search (79–89, 136–149) | Build `searchCondition` (FTS + ILIKE) and relevance-based `orderByColumns` when `search` is set. |
| 3 | `features/products/db/products.ts` | `getProductSearchSuggestions(q, limit)` (259–303) | Query active products by title match, order by starts-with then contains then newest, dedupe by title, return up to `limit` items. |

---

**Remember:** When you change any of this code (route, list search, or suggestions function), update this doc. See also [MOBILE-API.md](./MOBILE-API.md) for the API contract and [TECHNICAL-PRODUCTS.md](./TECHNICAL-PRODUCTS.md) § 1.5 for behaviour and ranking.
