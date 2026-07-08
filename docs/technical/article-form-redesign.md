# Article & News form visual redesign

## What changed

Restyled both the article form (`/admin/articles/new`, `/admin/articles/[id]/edit`) and
the news form (`/admin/news/new`, `/admin/news/[id]/edit`) to match the "Article form
design improvements" project in Claude Design (`Article Form.dc.html`, `News Form.dc.html`
— the two mockups are visually identical apart from copy): violet accent, card-based
sections with icon-badge headers, pill-style status segmented control, toggle-style
Featured switch, and a client-side reading-time indicator.

This was a **visual restyle only** — no schema or persistence changes. Both mockups also
showed Excerpt, Tags, an editable Slug, and Meta description fields; those were explicitly
deferred because they'd require new `articles`/`news` columns, a migration, and action/
query wiring (see decision log below).

Files touched:
- `features/articles/components/ArticleForm.tsx` — wrapped the form in a new `af-scope`
  root class, split the single main card into two headered cards ("Article details" and
  "Content"), added an author/reading-time row.
- `features/news/components/NewsForm.tsx` — same treatment, `nf-scope` root class,
  "Announcement basics" / "Content" cards.
- `lib/reading-time.ts` — pure helper, `estimateReadingTime`, shared by both forms.
- `app/admin-list-view.css` — `EDITOR FORM REDESIGN (af-* for Articles, nf-* for News)`
  section.

## Why scoped CSS instead of editing shared classes

`ArticleForm` and `NewsForm` share the same design-system classes (`n-editor-shell`,
`n-article-frame`, `n-side-card`, `n-status-seg`, `btn`, `lv-status`, …) defined once in
`admin-list-view.css`, and both render the shared `ContentMetaCard` component (category,
cover image, featured toggle). Editing those classes directly would restyle whichever form
wasn't the one being worked on.

Instead every rule is nested under a `.af-scope` (articles) or `.nf-scope` (news) wrapper
class added around each form's root `<div>`, and — since the two forms ended up wanting the
literal same visual language — most rules in the redesign section are written once with a
combined selector, e.g. `.af-scope .n-status-seg, .nf-scope .n-status-seg { ... }`. Two
mechanisms make this work without touching shared components:

1. **CSS custom property override.** `.af-scope`/`.nf-scope` redefine `--lv-accent`,
   `--lv-accent-600`, `--lv-accent-soft` to the violet from the mockups (`#6d5cf6`). Since
   every shared class (`.btn-primary`, `.n-side-card-ico`, `.n-status-opt.on`, …) already
   reads color via `var(--lv-accent)`, they automatically pick up the new violet inside
   either scope and stay unchanged everywhere else (custom properties inherit down the DOM
   tree).
2. **Descendant selectors, not class edits.** Rules like `.af-scope .n-status-seg { ... }`
   only apply to elements that are DOM descendants of that wrapper — which includes
   `ContentMetaCard`'s rendered output, since it's a child component in both forms' React
   trees. This let the Featured checkbox be restyled into a toggle switch and the
   category/cover-image card be re-themed without editing `ContentMetaCard.tsx`.

One override uses `!important`: `label:has(> input[type="checkbox"])` (scoped to both
`.af-scope` and `.nf-scope`) flips the label to `row-reverse` so the toggle renders on the
right (matching the mockups). `ContentMetaCard` sets `flexDirection` via inline `style`,
which normally beats any external stylesheet rule regardless of selector specificity —
`!important` is the only way to override an inline style from outside the component.

The publish-date `DatePicker` uses a different `id` per form (`publishDate` in
`ArticleForm`, `publish` in `NewsForm`), so that one rule is duplicated with each form's
own ID selector rather than shared.

## Reading time

`estimateReadingTime(contentJson, wordsPerMinute = 200)` in `lib/reading-time.ts` walks the
BlockNote block JSON (including nested `children`, e.g. list items) and concatenates all
inline `text` runs, then derives a word count and a
`Math.max(1, round(words / wordsPerMinute))` minute estimate. It's purely client-side and
cosmetic — nothing is persisted, and it recomputes on every keystroke from each form's
existing `content` state. It started as an articles-only helper under
`features/articles/lib/` and was promoted to `lib/` once `NewsForm` needed the identical
logic.

## Auth & permissions

No change. Articles remain gated by `requireFeatureAccess(FEATURE_KEYS.ARTICLES)`, news by
its equivalent news feature key, in their respective `new`/`[id]/edit` pages.

## Known limitations / decision log

- Excerpt, Tags, editable Slug, and Meta description from the mockups are **not**
  implemented — deferred pending a schema decision (new columns + migration) for both
  `articles` and `news`.
- The cover-image card keeps its existing `<img>` + button layout rather than the mockups'
  gradient-overlay-with-title treatment, since that needs the item's title threaded into
  `ContentMetaCard` (shared by both forms, out of scope for this pass).
- The publish-date field is a shadcn `Button`+`Popover` (`DatePicker`), not a plain bordered
  box; it's restyled via an ID selector rather than rebuilt.
