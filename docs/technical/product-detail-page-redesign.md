# Product Detail Page Redesign

## What changed

Full visual redesign of the product edit/create form (`features/products/components/ProductForm.tsx`) from a Card-based `odoo-form` layout to a custom `pd-*` design system.

Files touched:
- `features/products/components/ProductForm.tsx` — complete rewrite (~700 lines, was ~1741)
- `app/admin-list-view.css` — ~350 lines of `pd-*` classes appended
- `app/admin/products/[id]/edit/page.tsx` — wrapper div simplified from gem-theme container to `py-2`

## Layout

Two-column CSS Grid (`pd-grid`): main form column (`minmax(0, 1fr)`) + 320px sidebar.

```
pd-host
├── pd-topbar          (breadcrumbs)
├── pd-savebar         (sticky at top:56px, behind admin header)
└── pd-grid
    ├── pd-main (form)
    │   ├── pd-headcard   (hero: gem-hue gradient, status pills, quick stats) — edit only
    │   └── pd-card × 8  (sections: images, visibility, pricing, type, specs, cert, notes)
    └── pd-side
        ├── Status sidecard  (listing status select)
        ├── Change log       (edit only, if moderation history exists)
        └── Danger zone      (edit only)
```

## Gem-hue theming

`getGemHue(categoryName)` maps category names (ruby, sapphire, emerald, …) to an HSL hue value. Passed as `style={{ "--gem-hue": gemHue }}` on `.pd-headcard` and `.pd-hero-thumb`. CSS uses `hsl(var(--gem-hue, 260) ...)` for gradients — no JS color logic needed in CSS.

## Dirty state & save bar

`onInput` on the `<form>` element sets `dirty = true` for any field change. The save bar shows a yellow dot + "Unsaved changes" label when dirty. Discard navigates back; Save submits via `form="product-form"` attribute (submit button outside the form tag).

## Flag toggles

`isFeatured`, `isCollectorPiece`, `isPrivilegeAssist`, `isNegotiable` are controlled state. Rendered as `pd-toggle` labels (styled checkbox rows) that add the `on` class when true. Hidden `<input type="checkbox">` carries the `name` attribute for FormData.

## Server action compatibility

All `name` attributes preserved from the old form. No change to `createProductAction` or `updateProductAction` in `features/products/actions/products.ts`. FormData fields: `productId`, `status`, `imageUrls` (repeated), `videoUrls` (repeated), `certReportUrl`, `dimensions`, `title`, `identification`, `moderationStatus`, `price`, `currency`, `isNegotiable`, `promotionComparePrice`, `isFeatured`, `featured`, `featureDurationDays`, `isCollectorPiece`, `isPrivilegeAssist`, `isPromotion`, `productType`, `categoryId`, `stoneCut`, `metal`, `jewelleryGemstones` (JSON), `totalWeightGrams`, `weightCarat`, `shape`, `color`, `origin`, `laboratoryId`, `additionalMemos`, `description`.

## CSS variable mapping

Design used `--accent`, `--border`, `--text`. Mapped to project vars:
- `--accent` → `var(--lv-accent)`
- `--border` → `var(--lv-border)`
- `--text` → `var(--lv-text)`
- `--accent-soft` hardcoded to `#F3EEFF` (design uses solid color; `--lv-accent-soft` is transparent rgba)

## Auth & permissions

No change. Edit page is behind `app/admin/` which requires admin session via middleware.

## Known limitations

- Price breakdown uses a hardcoded 8% platform fee — update if fee structure changes
- Media upload UI (images/videos/cert) delegates to `UploadButton` component; upload flow unchanged
- `FormActionBar.tsx` is now unused (still exists in `features/products/components/`)
