# Collaborator Guide: Admin Product URL-Driven Search

## What this feature does

Typing in the search box on `/admin/products` updates the URL (`?search=<term>`) and re-fetches products server-side. The search term survives pagination and view-tab changes.

## Prerequisites

- Standard dev env (`.env.local`, PostgreSQL, `npm run dev`)
- Optional: run `scripts/postgres-fulltext-search.sql` against the DB for full-text index support (ILIKE fallback works without it)

## End-to-end usage

1. Open `/admin/products`
2. Type in the search bar — after 400 ms the URL updates and filtered results load
3. Click a pagination link or switch view tab — the search term stays in the URL
4. Clear the box — navigates back to the full unfiltered list

## Extending the search

### Add a new field to search on

In `features/products/db/products.ts`, add to the `or(...)` inside `searchCondition`:

```ts
ilike(yourTable.yourColumn, `%${escapeLike(search)}%`)
```

Make sure `yourTable` is already joined in the query.

### Add search to another admin list view

1. Accept a `search?: string` prop in your server component and pass it to your DB query.
2. In your client component, read `useSearchParams().get("search")` (or accept it as a prop).
3. Create a `handleSearch` debounce that calls `router.push(buildPageHref(1, activeView, q))` where `buildPageHref` appends `?search=<q>`.
4. Pass `defaultSearch={currentSearch}` and `onSearch={handleSearch}` to `<ListViewCard>`.

`ListViewCard` already wires `onSearch` to its search input — no changes needed there.

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| Search term lost after pagination click | `buildPageHref` not forwarding `search` | Update the helper to append `if (search?.trim()) p.set("search", search.trim())` |
| Search resets on view-tab switch | `buildViewHref` not forwarding `search` | Same fix as above |
| TypeScript: `onSearch` is undefined | Toolbar destructuring missing the prop | Add `onSearch` to Toolbar's destructured parameter list |
