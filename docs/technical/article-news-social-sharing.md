# Article/News Social Sharing

## What changed

- `lib/reading-time.ts` — exported `extractPlainText` (previously private), reused by the new excerpt helper.
- `lib/extract-excerpt.ts` (new) — truncates BlockNote content to a ~155-char plain-text excerpt for meta descriptions.
- `lib/share-links.ts` (new) — pure Facebook/Telegram share-URL builders.
- `components/share/ShareButtons.tsx` (new) — Facebook, Telegram, and Copy Link actions, used by both forms below.
- `features/articles/components/ArticleForm.tsx` — new "Share" sidebar card.
- `features/news/components/NewsForm.tsx` — new "Share" sidebar card.
- `app/articles/[id]/page.tsx`, `app/news/[id]/page.tsx` — added `generateMetadata()` for Open Graph/Twitter Card tags.
- `app/admin-list-view.css` — added `.n-share-row`/`.n-share-btn` classes.

## Data flow

Admin form loads `article`/`news` row (id, title, status, coverImage already present in props) → form computes `shareUrl` as `${env.NEXT_PUBLIC_SERVER_URL}/articles/{id}` (or `/news/{id}`) and a `disabledReason` from `mode`/`id`/`status` → `ShareButtons` renders three actions built from `shareUrl`/`title`, or a disabled+tooltip state.

Separately, on any request to the public detail page, `generateMetadata()` re-fetches the same row via `getArticleById`/`getNewsById`, and if `status === "published"`, builds `title`/`description`/`openGraph`/`twitter` fields using `extractExcerpt(content)` and `coverImage`. This is a second DB round-trip beyond the page component's own fetch — accepted since both are single-row primary-key lookups.

## Schema impact

None. No Drizzle schema changes.

## Auth & permissions

No new auth surface. `ShareButtons` is a client component rendered only inside the already-guarded `/admin/articles/*` and `/admin/news/*` pages. `generateMetadata()` runs unauthenticated (same as the public page it's attached to) and only ever reads published rows.

## Edge cases & known limitations

- Facebook/Telegram/Copy Link only — no other platforms, no auto-posting/OAuth.
- Share card is disabled (not hidden) in create mode and while the item is a draft.
- Missing `NEXT_PUBLIC_SERVER_URL` disables sharing entirely rather than building a broken URL.
- Missing `coverImage` omits `images` from metadata rather than emitting a broken image tag.
- The duplicate DB fetch between `generateMetadata` and the page component is not cached/deduped — out of scope for this change.
- News rows can also carry `scheduled`/`archived` status values (not just `draft`/`published`) even though `NewsForm`'s status control only offers draft/published. Both the Share card and `generateMetadata` gate strictly on `status === "published"`, so scheduled/archived items are correctly treated as non-shareable — same path as a draft — with no separate handling needed.
