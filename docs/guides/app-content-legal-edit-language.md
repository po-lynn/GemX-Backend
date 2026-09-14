# App Content → Legal & Guides: per-document edit language

How the "English/Myanmar/Thai/Korean" language selector works for the four
Legal & Guides documents (Terms & Conditions, Buying Guide, Selling Guide,
Privacy Policy) in `/admin/app-content`, and how to extend it.

## Prerequisites

- No env vars beyond the project defaults. Translation on save uses
  `GOOGLE_TRANSLATE_API_KEY` (optional; only needed to exercise the
  auto-translate path, not to edit/save in a single language).

## How it works

Each legal document has its **own** edit-language state in
`AppContentClient` (`features/app-content/components/AppContentClient.tsx`):

```ts
const [termsEditLanguage, setTermsEditLanguage] = useState<NewsLanguage>("English")
const [buyingEditLanguage, setBuyingEditLanguage] = useState<NewsLanguage>("English")
const [sellingEditLanguage, setSellingEditLanguage] = useState<NewsLanguage>("English")
const [privacyEditLanguage, setPrivacyEditLanguage] = useState<NewsLanguage>("English")
```

`legalEditLanguage` is *derived*, not its own state — it picks whichever of
the four matches the currently selected `legalDoc`:

```ts
const legalEditLanguage: NewsLanguage =
  legalDoc === "terms" ? termsEditLanguage
  : legalDoc === "buying" ? buyingEditLanguage
  : legalDoc === "selling" ? sellingEditLanguage
  : privacyEditLanguage

function setLegalEditLanguage(next: NewsLanguage) {
  if (legalDoc === "terms") setTermsEditLanguage(next)
  else if (legalDoc === "buying") setBuyingEditLanguage(next)
  else if (legalDoc === "selling") setSellingEditLanguage(next)
  else setPrivacyEditLanguage(next)
}
```

`legalEditLanguage`/`setLegalEditLanguage` are passed straight through to
`LegalGuidesTab` → `MultilangBlockNoteTab` as a single `editLanguage`/
`onEditLanguageChange` pair — those components don't know or care that
there are four underlying states.

**Consequence:** switching the "Document" dropdown remembers each
document's own selected language. If you set Terms to Myanmar, switch to
Buying Guide, then switch back to Terms, it's still showing Myanmar — it is
*not* reset to English on switch.

## Extending it

**To add a fifth legal document** (e.g. a "Refund Policy"):

1. Add its id to `LEGAL_DOC_OPTIONS` in `features/app-content/lib/legal-docs.ts`.
2. Add a `refundPolicy` field to `AppContentClientProps` and the relevant
   schemas/actions/db layer.
3. In `AppContentClient`, add a matching `useState<NewsLanguage>("English")`
   pair (e.g. `refundEditLanguage`/`setRefundEditLanguage`) and a new branch
   in both the `legalEditLanguage` derivation and `setLegalEditLanguage`.
4. Add a branch in `legalValue()`/`setLegalValue()` and in `handleSave`'s
   payload/`applySavedMultilang` switch.

**Do not** reintroduce a single shared `legalEditLanguage` `useState` — that
was the pre-fix bug (two conflicting declarations of the same name, one
stale `useState` and one derived value, which broke `npm run build` with a
"Identifier has already been declared" parse error). Keep one `useState`
per document and derive the "current" one from `legalDoc`.

## Common errors

- **`Identifier 'X' has already been declared` at build time** — you have
  two `const`/`function` declarations of the same name in the same scope.
  Search the file for the name; don't just rename one occurrence — decide
  which definition is actually correct and delete the other.
- **Switching documents doesn't reset the language selector to English** —
  this is intentional (see above), not a bug. If a specific document should
  reset on entry, do it explicitly in that document's own state, not via a
  shared reset in `switchLegalDoc`.
