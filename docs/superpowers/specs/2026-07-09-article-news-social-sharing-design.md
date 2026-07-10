# Article/News Social Sharing — Design Spec

**Date:** 2026-07-09
**Scope:** Share buttons in `ArticleForm`/`NewsForm` sidebars + Open Graph/Twitter Card metadata on the public detail pages.

---

## Problem

Admins publishing articles/news at `/admin/articles/*` and `/admin/news/*` have no way to share the public link to Facebook or Telegram directly from the form, and the public pages (`app/articles/[id]/page.tsx`, `app/news/[id]/page.tsx`) emit no Open Graph/Twitter Card metadata — any link that is shared (by any method) previews as a bare URL with no title, image, or description.

---

## Approach

**Hand-rolled share links, no new dependency.** Facebook and Telegram both support simple GET-parameter share URLs (`facebook.com/sharer/sharer.php?u=`, `t.me/share/url?url=&text=`); a third-party library (e.g. `react-share`) would add a dependency for something three URL templates cover. Copy-link uses the native `navigator.clipboard` API, consistent with no new dependency.

Rejected alternative: a generic `features/sharing/` module with a configurable platform registry — over-abstracted for three fixed platforms with no near-term plan to add more.

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `components/share/ShareButtons.tsx` | Shared UI: Facebook, Telegram, Copy Link buttons |
| `lib/extract-excerpt.ts` | Plain-text excerpt (~155 chars) from BlockNote JSON content, for OG `description` |
| `lib/share-links.ts` | Pure URL builders: `buildFacebookShareUrl`, `buildTelegramShareUrl` |

### Modified files

| File | Change |
|------|--------|
| `features/articles/components/ArticleForm.tsx` | New "Share" sidebar card after the publishing card (after line 405) |
| `features/news/components/NewsForm.tsx` | New "Share" sidebar card after the publishing card (after line 398) |
| `app/articles/[id]/page.tsx` | Add `generateMetadata()` |
| `app/news/[id]/page.tsx` | Add `generateMetadata()` |

---

## `ShareButtons` component

```typescript
type ShareButtonsProps = {
  url: string;
  title: string;
  disabled?: boolean;
  disabledReason?: string;
};
```

- Renders three buttons: Facebook, Telegram, Copy Link — icon + label, styled to match the existing `n-side-card` sidebar pattern (same visual family as the status toggle buttons, `n-status-opt`).
- Facebook / Telegram buttons are plain `<a target="_blank" rel="noopener noreferrer">` — no JS popup-window logic, so they work with keyboard/middle-click and don't need `window.open`.
- Copy Link is a `<button>` calling `navigator.clipboard.writeText(url)`:
  - Success → `toast.success("Link copied")` (via `sonner`, already used elsewhere e.g. `features/colors/components/ColorForm.tsx`)
  - Failure (clipboard API unavailable/denied) → catch, `toast.error("Couldn't copy link")`, no crash.
- When `disabled` is true: buttons render with `aria-disabled="true"`, reduced opacity, `pointer-events-none`, and wrap in a `title={disabledReason}` for a native tooltip. Anchors omit `href` when disabled so they aren't navigable.

## `lib/share-links.ts`

```typescript
function buildFacebookShareUrl(url: string): string
function buildTelegramShareUrl(url: string, title: string): string
```

Both `encodeURIComponent` their inputs. Pure functions — unit-testable without DOM/network.

## `lib/extract-excerpt.ts`

```typescript
function extractExcerpt(contentJson: string, maxLength?: number): string
```

Parses the BlockNote JSON array (same shape `lib/reading-time.ts` already parses), concatenates block text content in order, collapses whitespace, truncates to `maxLength` (default 155) on a word boundary, appends `…` if truncated. Returns `""` for empty/unparseable content (caller omits the `description` field in that case rather than emitting an empty string).

---

## Form integration

Both forms add an identical sidebar card, sibling to the existing `n-side-card` publishing card:

```tsx
<div className="n-side-card">
  <div className="af-card-head"> {/* nf-card-head in NewsForm */}
    <span className="af-card-ico">...</span>
    <span className="af-card-title">Share</span>
  </div>
  <ShareButtons
    url={shareUrl}
    title={title}
    disabled={!isEdit || !article?.id || status !== "published"}
    disabledReason={
      !isEdit || !article?.id
        ? "Save first to share"
        : status !== "published"
          ? "Publish first to share"
          : undefined
    }
  />
</div>
```

`shareUrl` is computed as:

```typescript
const shareUrl = article?.id
  ? `${env.NEXT_PUBLIC_SERVER_URL ?? ""}/articles/${article.id}`
  : "";
```

(`/news/${news.id}` in `NewsForm.tsx`, using the existing `env` accessor from `data/env/client.ts` — no new env var). When `NEXT_PUBLIC_SERVER_URL` is unset, `shareUrl` is `""`, `disabled` is forced true, and `disabledReason` becomes `"Sharing unavailable"` (env missing takes precedence over the save/publish checks).

`title` passed to `ShareButtons` is the live `title` state — the same value used elsewhere in the form, not re-fetched.

Card renders in both create and edit mode (always disabled in create mode, per the checks above) so admins see the feature exists rather than have it appear only after their first save.

---

## Open Graph / Twitter Card metadata

Added to both `app/articles/[id]/page.tsx` and `app/news/[id]/page.tsx`:

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticleById(id);

  if (!article || article.status !== "published") {
    return {};
  }

  const description = extractExcerpt(article.content) || undefined;

  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      images: article.coverImage ? [article.coverImage] : undefined,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: article.coverImage ? [article.coverImage] : undefined,
    },
  };
}
```

(Same shape for news, using `getNewsById`/`item.content`/`item.coverImage`.) Returning `{}` for a draft/missing item falls back to the root layout's metadata — no draft content is ever exposed via metadata scraping. This duplicates the fetch already done in the page component; Next.js dedupes `fetch`-based data loaders automatically, but these use direct Drizzle queries, so the DB is hit twice per request. Accepted for now — both queries are single-row primary-key lookups, and Next.js does not currently expose a cache-per-request primitive for arbitrary async functions without adding `React.cache()`. Out of scope to add caching here.

---

## Error handling

- Clipboard write failure → toast error, no crash (see above).
- Missing `coverImage` → `images` field omitted entirely (`undefined`), not an empty array or broken URL — Facebook/Telegram fall back to a text-only preview card.
- Missing `NEXT_PUBLIC_SERVER_URL` → share card fully disabled with "Sharing unavailable", never constructs a URL like `"undefined/articles/…"`.
- Empty/unparseable `content` → `extractExcerpt` returns `""`, caller passes `undefined` as `description` rather than an empty string (avoids an empty `<meta description="">` tag).

---

## Tests

**`tests/unit/share-links.test.ts`**
- `buildFacebookShareUrl` encodes special characters in the URL
- `buildTelegramShareUrl` encodes both URL and title, joins with correct params
- Both handle an empty-string input without throwing

**`tests/unit/extract-excerpt.test.ts`**
- Empty content (`"[]"`) → `""`
- Short content (under maxLength) → returned verbatim, no ellipsis
- Long content → truncated at word boundary at/under maxLength, ends with `…`
- Malformed JSON → `""` (caught, not thrown)
- Custom `maxLength` respected

**`tests/component/share-buttons.test.tsx`**
- Enabled state renders 3 interactive elements (Facebook link, Telegram link, Copy button) with correct `href`s
- Disabled state: anchors have no `href`, `aria-disabled="true"`, `title` matches `disabledReason`
- Clicking Copy calls `navigator.clipboard.writeText` with `url` (mocked) and shows success toast
- Clipboard rejection shows error toast, does not throw

**`tests/api/article-metadata.test.ts`** (and news equivalent, or combined)
- Published article with `coverImage` → `generateMetadata` returns title/description/openGraph.images/twitter.images populated
- Published article without `coverImage` → `images` fields are `undefined`, not `[undefined]` or `[""]`
- Draft article → `generateMetadata` returns `{}`
- Non-existent id → `generateMetadata` returns `{}`

---

## Out of scope

- X (Twitter), WhatsApp, LinkedIn, or any platform beyond Facebook/Telegram/Copy Link (per explicit scoping decision)
- Auto-posting via platform APIs / OAuth-connected accounts
- Slug-based public URLs (articles have a `slug` field today but it is unused for routing; this feature does not change that)
- Per-request caching of the duplicate `getArticleById`/`getNewsById` call between `generateMetadata` and the page component
- Share analytics/click tracking
