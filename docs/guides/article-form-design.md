# Article & News form design system (`af-*` / `nf-*`)

The article form (`/admin/articles/new`, `/admin/articles/[id]/edit`) and the news form
(`/admin/news/new`, `/admin/news/[id]/edit`) each have their own violet visual theme
layered on top of the shared editor classes they both use. This guide covers how it's
wired up so you can extend it safely.

## Prerequisites

Nothing extra — no new env vars or dependencies. The violet theme reuses fonts already
loaded globally (`Plus Jakarta Sans` via `--font-sans`, `Cormorant Garamond` via
`--font-heading`).

## How it works

`ArticleForm` and `NewsForm` each render everything inside their own wrapper:

```tsx
// ArticleForm.tsx
return <div className="af-scope">{/* ...breadcrumbs, save bar, form... */}</div>;

// NewsForm.tsx
return <div className="nf-scope">{/* ...breadcrumbs, save bar, form... */}</div>;
```

`app/admin-list-view.css` has a section titled
`EDITOR FORM REDESIGN (af-* for Articles, nf-* for News)`. Two kinds of rules live there:

- **New classes**, one set per form (`af-card-head` / `nf-card-head`,
  `af-card-ico` / `nf-card-ico`, `af-two-col` / `nf-two-col`, `af-input` / `nf-input`,
  `af-readingtime` / `nf-readingtime`) — used directly in each form's JSX. They're
  duplicated (not shared) because each form's markup references its own prefix.
- **Scoped overrides** of shared classes, written once with a combined selector since both
  forms want the same look — e.g. `.af-scope .n-status-seg, .nf-scope .n-status-seg { ... }`.
  These repaint classes the *other* form also uses, but only take effect inside their own
  scope.

The one exception is the publish-date field: `ArticleForm`'s `DatePicker` has
`id="publishDate"`, `NewsForm`'s has `id="publish"`, so that rule targets each ID
separately (`.af-scope #publishDate`, `.nf-scope #publish`).

## Extending it

**Add a new card to the main column** (e.g. an "SEO" card) in either form — copy the
`af-card-head`/`nf-card-head` + `n-article-frame` pattern already used for "Content":

```tsx
<div className="n-article-frame">
  <div className="af-card-head"> {/* or nf-card-head in NewsForm */}
    <span className="af-card-ico"><svg>...</svg></span>
    <div>
      <div className="af-card-title">Your card title</div>
      <div className="af-card-sub">One-line description.</div>
    </div>
  </div>
  {/* fields */}
</div>
```

**Add a persisted field** (e.g. finally wiring up Excerpt/Tags/Meta description from the
original mockups): this needs more than the form —
1. Add the column to `drizzle/schema/articles-schema.ts` and/or `news-schema.ts`, run
   `npm run db:generate` (do **not** run `db:migrate`/`db:push` — migrations are applied
   manually).
2. Extend `ArticleRow`/`NewsRow` and the `create*InDb`/`update*InDb` helpers in
   `features/articles/db/articles.ts` / `features/news/db/news.ts`.
3. Read/write the field in the corresponding `actions/*.ts` server action.
4. Add the input to the form, styled with the `af-input`/`nf-input` classes.

**Change the accent color:** edit the three custom properties on `.af-scope, .nf-scope` in
`admin-list-view.css` — every button, badge, and icon inside either form derives its color
from `var(--lv-accent)` / `var(--lv-accent-600)` / `var(--lv-accent-soft)`, so nothing else
needs to change. If you want the two forms to diverge visually, split that one rule into
`.af-scope { ... }` and `.nf-scope { ... }` blocks with different values.

**Reuse the reading-time estimate elsewhere:** import `estimateReadingTime` from
`@/lib/reading-time` — it takes a BlockNote content JSON string and returns
`{ words, minutes }`; it's pure and unit-tested in `tests/unit/reading-time.test.ts`.

## Common errors

- **"My change also affected the other form"** — you edited a base class (`.n-side-card`,
  `.btn-primary`, etc.) instead of adding a `.af-scope ...`/`.nf-scope ...` override. Undo
  and re-scope it.
- **Toggle switch not rendering for a new checkbox** — the CSS selector is
  `.af-scope .n-side-card input[type="checkbox"]` (and the `.nf-scope` equivalent);
  checkboxes outside an `.n-side-card` won't pick up the switch styling.
- **Inline styles winning over your override** — `ContentMetaCard` sets some layout via
  inline `style={{...}}`. Only `!important` beats inline styles from an external
  stylesheet; see the existing `label:has(...)` rule for the pattern.
- **CSS comment breaks the whole stylesheet build** — never write a literal `*/` inside a
  `/* ... */` comment body (e.g. writing `n-*/ud-*` in prose to mean "the n- and ud-
  classes"); it closes the comment early and Turbopack fails with "Parsing CSS source code
  failed" pointing at unrelated code below it.
