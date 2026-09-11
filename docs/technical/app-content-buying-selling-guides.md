# App Content — Buying Guide & Selling Guide

## What changed

Added **Buying Guide** and **Selling Guide** tabs beside Terms & Conditions (same BlockNote + EN→MY/TH/KO pattern).

| Path | Role |
| --- | --- |
| `drizzle/migrations/0093_buying_selling_guide_sections.sql` | Enum values `buying_guide`, `selling_guide` |
| `features/app-content/components/MultilangBlockNoteTab.tsx` | Shared editor UI |
| `features/app-content/components/BuyingGuideTab.tsx` / `SellingGuideTab.tsx` | Tab wrappers |
| `app/api/mobile/buying-guide` / `selling-guide` | Public published read |

## Data flow

Same as Terms: edit BlockNote → **Save** (active tab) → optional English auto-translate → draft+published upsert → mobile GET.

## Schema

JSON shape identical to Terms:

```ts
{ contentEn, contentMy, contentTh, contentKo, sourceLanguage }
```

## Auth

Same as App Content (`settings.app_content` / admin save). Mobile routes public.
