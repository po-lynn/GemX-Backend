# Admin Product URL-Driven Search

## What changed

URL-based search state was added to the admin products list (`/admin/products`). Previously, search was purely client-side (filtered rows already loaded on the page); now the search term lives in the URL, drives server-side data fetching, and persists across pagination and view-tab changes.

**Files touched:**
- `app/admin/products/page.tsx` — extracts `search` from `searchParams`, passes it to `getAdminProducts` and `ProductsListView`
- `features/products/components/ProductsListView.tsx` — adds debounced `router.push` on search input; `buildViewHref` and `buildPageHref` now carry the search term forward
- `components/admin/list-view/ListViewCard.tsx` — new `defaultSearch` and `onSearch` props; Toolbar wires `onSearch` to the existing search input

## Data flow

```
URL ?search=<term>
  → app/admin/products/page.tsx (server component)
      → getAdminProducts({ search }) — filtered at DB layer
      → <ProductsListView search={search} /> (client component)
          → ListViewCard defaultSearch={currentSearch} onSearch={handleSearch}
              → user types → 400ms debounce → router.push(buildPageHref(1, view, q))
                  → URL updates → server re-fetches with new search term
```

## Database filtering (`features/products/db/products.ts`)

`getAdminProducts` applies a compound OR condition when `search` is non-empty:
- Full-text search on `title || description` via `to_tsvector` / `plainto_tsquery` (uses `product_title_description_fts_idx` when `scripts/postgres-fulltext-search.sql` has been run)
- `ILIKE %term%` fallback on `product.title`, `user.name`, `user.phone`, `user.email`

The same `escapeLike` helper protects against SQL wildcard injection.

## Schema impact

None — `search: z.string().optional()` was already present in `adminProductsSearchSchema` (`features/products/schemas/products.ts`).

## Auth & permissions

Server component only. Requires an active admin session (enforced by the existing `adminMiddleware` in `app/admin/`). No new API routes.

## URL parameter

`?search=<term>` is added alongside `?page=` and `?view=`. View-tab switches and pagination links always carry the current search term forward; navigating without a term drops the parameter (no empty `?search=`).

## Edge cases & known limitations

- Debounce is 400 ms. Fast typists trigger one request per 400 ms burst rather than per keystroke.
- The full-text search index is optional (`scripts/postgres-fulltext-search.sql`). Without it, only `ILIKE` runs — still correct but slower on large tables.
- Trimming happens at both the page layer (`params.search?.trim()`) and the DB layer (`opts.search?.trim()`), so stray whitespace in the URL doesn't cause mismatches.
