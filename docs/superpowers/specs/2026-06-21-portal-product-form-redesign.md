# Portal Product Form Redesign

**Date:** 2026-06-21  
**Scope:** `components/portal/PortalProductForm.tsx` + portal new/edit pages  
**Goal:** Upgrade portal seller product form to match admin `ProductForm` UI/UX quality

---

## What Changes

Replace the current basic shadcn/ui card form with the same rich `pd-*` CSS experience used in the admin `ProductForm`. The `pd-*` classes are already globally available via `globals.css → admin-list-view.css` — no new CSS needed.

**Excluded (admin-only, never shown to portal users):**
- Seller picker / Own Product checkbox / isOwnProduct
- Status field (active / pending / archive / sold / hidden)
- Moderation status field
- Feature duration / points / expiry (admin sets these when approving featured)

---

## Layout

Single-column `pd-host` layout — no sidebar. Portal users have no Status or Moderation card to display, so a sidebar adds no value.

```
┌─────────────────────────────────────────┐
│  pd-stickybar                           │
│    pd-topbar  (breadcrumb + title)      │
│    pd-savebar (unsaved dot + actions)   │
├─────────────────────────────────────────┤
│  form (pd-main, full width)             │
│    Section: Images & videos             │
│    Section: Basic info                  │
│    Section: Pricing                     │
│    Section: Visibility                  │
│    Section: Product type & category     │
│    Section: Specifications              │
│    Section: Certification               │
│    Section: Notes & description         │
└─────────────────────────────────────────┘
```

---

## Sticky Bar

Same pattern as admin:

- **pd-topbar:** Breadcrumb ("← My products › New product"), page title ("New product" / "Edit product")
- **pd-savebar:** Dirty-state dot + "Unsaved changes" label, Discard button (→ `/portal/products`), Save button
- Dirty flag set on any `onInput` event or when media/cert state changes

The page files (`new/page.tsx`, `[id]/edit/page.tsx`) drop their header markup — it moves inside the form component.

---

## Sections

### 1. Images & videos
- Icon: `Upload`, tone: purple
- Real XHR file upload to `/api/upload/product-media` (same endpoint as admin)
- Thumbnail strip with lightbox viewer (`ImageViewer`, `VideoViewer` — copied from admin form)
- Upload progress card
- Add image / Add video drop zones
- Max 10 images, 5 videos
- Replaces the current URL textarea fields

### 2. Basic info
- Icon: `Package`, tone: blue
- Fields: Title (required), SKU, Identification (select: Natural / Heat Treated / Treatments / Others), Description (textarea)
- No moderation status field

### 3. Pricing
- Icon: `BadgeDollarSign`, tone: emer
- Fields: Price (required), Currency (USD / MMK)
- Negotiable toggle (`pd-negotiable` style, same as admin)

### 4. Visibility
- Icon: `Sparkles`, tone: purple
- Four `pd-toggle` checkboxes: Featured listing, Collector piece, Privilege Assist, Promotion
- All editable by portal users
- These map to `isFeatured`, `isCollectorPiece`, `isPrivilegeAssist`, `isPromotion`
- No feature duration / expiry fields (admin sets those separately after approval)

### 5. Product type & category
- Icon: `Layers`, tone: blue
- Fields: Product type (Loose stone / Jewellery), Category, Cut (loose stone) or Metal (jewellery)
- Jewellery: full gemstone dialog (same `FormGemstoneEntry` type and dialog as admin)
- Gemstone dialog fields: stone category, weight (carat), piece count, dimensions, color, shape, origin, cut, transparency, comment, inclusions

### 6. Specifications
- Icon: `Info`, tone: slate
- Loose stone: Weight (carat, required), Color (required), Origin (required), Cut (select), Shape (select), Dimensions (three-part L × W × H inputs)
- Jewellery: Metal, Total weight (grams), Piece count, Dimensions (three-part)
- Replaces the single `dimensions` text input with three separate inputs joined as `L × W × H`

### 7. Certification
- Icon: `Award`, tone: amber
- Lab dropdown (from `laboratories` prop — `LaboratoryOption[]` fetched via `getAllLaboratories()` in each page file)
- Certificate file upload (XHR to `/api/upload/certificate`) with `CertificateViewer` on success
- Fields: Report number, Report date, Report URL (auto-populated from upload), Additional notes
- Replaces the current plain URL text input

### 8. Notes & description
- Icon: `StickyNote`, tone: slate
- Single textarea: Additional memos / extra notes
- Description is in Basic info section; this section holds `additionalMemos`

---

## Form Submission

Keep the existing `createPortalProductAction` / `updatePortalProductAction` server actions. The component switches from controlled `useState` per field to a native `<form ref>` + `FormData` submit (matching admin pattern) to support the hidden input pattern for media URLs, cert URL, dimensions, and gemstones.

New fields to wire into the portal actions:
- `isFeatured`, `isCollectorPiece`, `isPrivilegeAssist`, `isPromotion` (boolean)
- `jewelleryGemstones` (JSON string, jewellery only)
- Three-part dimensions joined as `L × W × H`
- `certReportUrl` (from upload, hidden input)

**Important:** `features/products/actions/portal-products.ts` currently hardcodes all visibility fields to `undefined`, stripping them before validation:
```js
isFeatured: undefined,
isCollectorPiece: undefined,
isPrivilegeAssist: undefined,
isPromotion: undefined,
```
Both `createPortalProductAction` and `updatePortalProductAction` must be updated to remove these overrides so the values from the form pass through to `productCreateSchema` / `productUpdateSchema`.

---

## Component Reuse from Admin ProductForm

These sub-components are extracted verbatim from `ProductForm.tsx` into the new portal form (or into a shared location if used by both):

| Component | Purpose |
|---|---|
| `ImageViewer` | Lightbox for images |
| `VideoViewer` | Lightbox for videos |
| `CertificateViewer` | Certificate display + remove |
| `parseDimensions()` | Split "L × W × H" string into parts |
| `isPdfUrl()` | Detect PDF certs |
| `getGemHue()` | Accent color by gem category |

The gemstone dialog state and logic is also replicated (it's tightly coupled to form state, so it lives inside the form component rather than being extracted).

---

## Files Touched

| File | Change |
|---|---|
| `components/portal/PortalProductForm.tsx` | Full rewrite |
| `app/portal/products/new/page.tsx` | Remove header markup, add `getAllLaboratories()` fetch |
| `app/portal/products/[id]/edit/page.tsx` | Remove header markup, add `getAllLaboratories()` fetch |
| `features/products/actions/portal-products.ts` | Add new visibility + gemstone fields |
| `features/products/schemas/portal-products.ts` (if exists) | Extend Zod schema for new fields |

---

## Out of Scope

- No new CSS (pd-* classes already global)
- No changes to admin ProductForm
- No changes to API routes or database schema
- No mobile API changes
