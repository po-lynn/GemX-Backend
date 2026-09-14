# Fix: production build failure in AppContentClient (duplicate `legalEditLanguage`)

## What changed and why

`npm run build` failed at the webpack/SWC parse stage with:

```
Module parse failed: Identifier 'legalEditLanguage' has already been declared (101:10)
```

in `features/app-content/components/AppContentClient.tsx`. Redeclaring a
`const` with the same name in the same scope is a hard `SyntaxError`, caught
before type-checking even runs.

The file had two conflicting definitions of `legalEditLanguage`, left over
from a partial refactor from "one shared edit-language for all Legal &
Guides documents" to "each legal document remembers its own edit language":

1. A `useState` (the old design): `const [legalEditLanguage, setLegalEditLanguage] = useState<ContentLanguage>("English")`.
2. A derived value (the new design, further down the file): `legalEditLanguage` computed from whichever of `termsEditLanguage` / `buyingEditLanguage` / `sellingEditLanguage` / `privacyEditLanguage` matches the currently selected `legalDoc`, plus a `setLegalEditLanguage` function that dispatches to the right per-doc setter.

The refactor to (2) was incomplete: only `privacyEditLanguage` (and
`aboutEditLanguage`, unrelated to legal docs) had been given a `useState`.
`termsEditLanguage`, `buyingEditLanguage`, and `sellingEditLanguage` were
referenced (lines computing the derived value, and later in `handleSave`'s
`applySavedMultilang` calls) but never declared — these would have been
`ReferenceError`s at runtime even if the duplicate-`const` parse error were
somehow bypassed. Additionally, `aboutEditLanguage` and the old
`legalEditLanguage` were typed `useState<ContentLanguage>`, but
`ContentLanguage` was never imported in this file (only `NewsLanguage` was) —
`ContentLanguage` is just an alias of `NewsLanguage` (`lib/google-translate.ts`),
re-exported from `@/features/content/services/google-translate`.

### Fix (`features/app-content/components/AppContentClient.tsx`)

- Removed the old single `legalEditLanguage`/`setLegalEditLanguage` state.
- Added the three missing per-document states: `termsEditLanguage`,
  `buyingEditLanguage`, `sellingEditLanguage` (each `useState<NewsLanguage>("English")`),
  matching the existing `privacyEditLanguage` declaration.
- Changed `aboutEditLanguage`'s type param from the unimported `ContentLanguage`
  to `NewsLanguage` (same underlying type, already imported in this file).
- Removed `setLegalEditLanguage("English")` from `switchLegalDoc`. Under the
  old shared-state design this reset was needed when switching documents.
  Under the new per-document design it is actively wrong: each document's
  `useState` already defaults to `"English"` on its own, and the call was a
  stale closure over `legalDoc` (`setLegalDoc` hadn't re-rendered yet), so it
  would have reset the language of the document being switched *away from*,
  not the new one — and even fixed, it would defeat the point of
  remembering each document's language independently across switches.

No schema, route, or prop-shape changes — this is a pure client-component
bugfix. `LegalGuidesTab` / `MultilangBlockNoteTab`'s props (`editLanguage: NewsLanguage`,
`onEditLanguageChange: (lang: NewsLanguage) => void`) were already correct
and unchanged; `AppContentClient` now actually satisfies them.

### Unrelated build blocker also fixed

After the above, `npm run build`'s TypeScript pass failed separately in
`tests/api/product-shapes.test.ts`: `GET /api/product-shapes` (`app/api/product-shapes/route.ts`)
takes no arguments (it needs no request data), but the test still called
`GET({} as NextRequest)`. Updated the test to call `GET()`. This was a
pre-existing mismatch, unrelated to the AppContentClient bug — the type
checker just hadn't run far enough to report it while the webpack parse
error was blocking the build.

## Data flow

Purely client-side React state — no server round trip involved in the fix
itself. `legalDoc` (which document is selected) drives which per-document
`useState` pair `legalEditLanguage`/`setLegalEditLanguage` proxies to; that
pair flows into `LegalGuidesTab` → `MultilangBlockNoteTab`, which uses it to
pick the right locale field (`contentEn`/`contentMy`/`contentTh`/`contentKo`)
to show in the BlockNote editor. On Save, `handleSave` still reads the
correct per-document language state (`termsEditLanguage`, etc.) to decide
whether to pass `translateFromEnglish: true` to `saveAppContentAction`.

## Auth & permissions

Unaffected — `AppContentClient` is rendered behind whatever admin-session
guard wraps the `/admin/app-content` page; `saveAppContentAction` is a
`"use server"` action already guarded via `requireActionRole`/`canManageAppContent`.

## Edge cases & known limitations

- Per-document edit language is in-memory (component `useState`) only — it
  resets to `"English"` for all four documents on page reload, same as
  before this fix.
- `handleSave`'s `translateFromEnglish` flag for the "about" tab still reads
  `legalEditLanguage` (line ~200, pre-existing), not `aboutEditLanguage`.
  Since `legalEditLanguage` is now defined purely in terms of `legalDoc`
  (independent of `tab`), this only matters when `tab === "about"` — that
  branch does read `legalEditLanguage`'s value for whatever `legalDoc` last
  was, not the About tab's own language. This bug predates this fix and is
  out of scope here (it was already present in the derived-value code before
  the duplicate declaration was found); flagging it for a follow-up.
