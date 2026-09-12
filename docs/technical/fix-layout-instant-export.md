# Fix: invalid `instant` Layout export

## What changed

`next build` failed with:

```text
Layout "app/account/layout.tsx" does not match the required types of a Next.js Layout.
"instant" is not a valid Layout export field.
```

Removed `export const instant = false` from all App Router **layouts** and **pages** under `app/` (layouts failed typecheck first; pages used the same invalid segment export).

Also restored `CONTENT_LANGUAGES` / `ContentLanguage` aliases in `lib/google-translate.ts` (used by App Content multilang tabs).

## Why

Installed Next (build reported 16.1.6) does not allow `instant` as a Layout/Page segment config export. Routes remain dynamic via `connection()` / `headers()` / session reads.
