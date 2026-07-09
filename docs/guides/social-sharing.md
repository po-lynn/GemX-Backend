# Social Sharing (Articles & News)

## Prerequisites

- `NEXT_PUBLIC_SERVER_URL` must be set (e.g. `http://localhost:3000` locally, the production domain in prod) — without it, share buttons show as disabled with "Sharing unavailable".

## Using it

1. Open `/admin/articles/{id}/edit` (or `/admin/news/{id}/edit`) for a **published** item.
2. In the sidebar, the "Share" card shows three actions: **Facebook**, **Telegram**, **Copy link**.
3. Facebook/Telegram open that platform's own share dialog in a new tab, pre-filled with the public URL (and title, for Telegram).
4. Copy link copies the public URL to the clipboard and shows a toast.

While the item is a draft, or on the "New" form before it's ever been saved, the three actions are greyed out — hover to see why (a native tooltip via the `title` attribute).

## Extending it

- **Add another platform:** add a `buildXShareUrl()` function to `lib/share-links.ts`, then add one more `<a>` to `components/share/ShareButtons.tsx` following the existing Facebook/Telegram pattern. No prop changes needed — every consumer of `ShareButtons` gets the new button automatically.
- **Change the excerpt length:** pass a second argument to `extractExcerpt(content, 200)` in either page's `generateMetadata`.
- **Add sharing to another content type:** reuse `ShareButtons` directly — it only needs a `url` and a `title`, it has no article/news-specific logic.

## Common errors

- **"Sharing unavailable" tooltip in prod:** `NEXT_PUBLIC_SERVER_URL` isn't set for that environment — set it and redeploy.
- **Facebook/Telegram preview shows no image:** the item's `coverImage` is empty — set one via the "Cover image" field in the sidebar's mobile-display card.
- **Preview shows stale title/description after an edit:** Facebook/Telegram cache link previews aggressively; use each platform's own cache-debugger tool (e.g. Facebook's Sharing Debugger) to force a re-scrape — this is a platform-side cache, not a bug in this app.
