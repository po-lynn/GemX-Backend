# Plan: Portal Product Form Redesign

**Spec:** `docs/superpowers/specs/2026-06-21-portal-product-form-redesign.md`  
**Date:** 2026-06-21

---

## Phase 0: Documentation Discovery (Complete)

### Allowed APIs & Patterns

| Pattern | Source |
|---|---|
| `pd-*` CSS classes (globally available) | `app/globals.css` → `@import "./admin-list-view.css"` |
| Gemstone dialog JSX (add/edit/view) | `features/products/components/ProductForm.tsx:2467–2554` |
| Gemstone list JSX | `ProductForm.tsx:1915–2013` |
| Specifications section JSX | `ProductForm.tsx:2016–2179` |
| Certification section JSX | `ProductForm.tsx:2184–2261` |
| Notes section JSX (tabbed) | `ProductForm.tsx:2263–2319` |
| `ImageViewer`, `VideoViewer`, `CertificateViewer`, `parseDimensions`, `isPdfUrl`, `getGemHue` | `ProductForm.tsx:88–313` |
| `handleUploadMedia` XHR pattern | `ProductForm.tsx:896–955` — posts to `/api/upload/product-media` |
| `handleUploadCertificate` XHR pattern | `ProductForm.tsx:957–983` — posts to `/api/upload/certificate` |
| `getAllLaboratories()` | `features/laboratory/db/laboratory.ts:17` → `Promise<LaboratoryOption[]>` |
| Visibility toggles schema | `features/products/schemas/products.ts:168–173` — `z.coerce.boolean().optional()` |
| `normalizeProductBody` | `features/products/api/normalize-product-body.ts` — handles isFeatured/isPromotion str→bool |

### Critical Finding: Portal Actions Strip Visibility Fields

`features/products/actions/portal-products.ts` sets these to `undefined` before Zod parse — both in create (line 22) and update (line 63):
```
isFeatured: undefined,
isCollectorPiece: undefined,
isPrivilegeAssist: undefined,
isPromotion: undefined,
```
These lines must be removed in Phase 1.

### Key Constraints

- Portal form uses controlled state + `Record<string,unknown>` object submission (not FormData). Keep this — portal actions accept `Record<string,unknown>`.
- Origin in portal stays as a text `<input>` — no `OriginOption[]` prop on portal pages.
- Three-part dimensions: state `[dim1, dim2, dim3]` joined to `"L × W × H"` before submit.
- Visibility toggles: no feature duration / expiry fields (admin-only). Just the four boolean toggles.
- `normalizeProductBody` normalizes `isFeatured` and `isPromotion` from string; `isCollectorPiece` and `isPrivilegeAssist` go through `z.coerce.boolean()` in Zod directly — no extra normalization needed.

---

## Phase 1: Update Portal Actions (Allow Visibility Fields)

**Goal:** Remove the hard-coded `undefined` overrides so visibility toggles from the form are actually saved.

### Task 1.1 — Edit `features/products/actions/portal-products.ts`

In `createPortalProductAction` (around line 20–28), remove these four lines from the `normalizeProductBody({...input, ...})` call:
```
isFeatured: undefined,
featured: undefined,
featureDurationDays: undefined,
isCollectorPiece: undefined,
isPrivilegeAssist: undefined,
isPromotion: undefined,
promotionComparePrice: undefined,
```
Keep: `moderationStatus: "pending"` (portal users cannot set moderation).

In `updatePortalProductAction` (around line 60–70), remove the same four visibility overrides (`isFeatured`, `isCollectorPiece`, `isPrivilegeAssist`, `isPromotion`). Keep `moderationStatus` stripped (force back to pending on update so admin re-reviews).

Also check the `updateProductInDb` call within `updatePortalProductAction` — if visibility fields are excluded from the spread passed to it, add them. (Read the function call block lines 79–110.)

### Verification

```bash
grep -n "isFeatured\|isCollector\|isPrivilege\|isPromotion" features/products/actions/portal-products.ts
# Should show only the fields being passed THROUGH, not set to undefined
```

---

## Phase 2: Rewrite PortalProductForm.tsx

**Goal:** Full rewrite of `components/portal/PortalProductForm.tsx` matching admin UI/UX, using `pd-*` CSS classes.

The controlled state + object-submit pattern is kept. New state added for media, cert, dimensions, gemstones, and visibility toggles.

### Task 2.1 — Imports

Copy these imports from `ProductForm.tsx` (lines 1–53):
- All Lucide icons used: `Award`, `BadgeDollarSign`, `Check`, `ChevronLeft`, `ChevronRight`, `Eye`, `FileText`, `Gem`, `Info`, `Layers`, `Package`, `Pencil`, `Play`, `Plus`, `Save`, `Sparkles`, `StickyNote`, `Trash2`, `Upload`, `Video`, `X`
- shadcn: `Button`, `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
- Same `Link`, `useState`, `useEffect`, `useRef`, `useCallback` imports
- Type: `LaboratoryOption` from `@/features/laboratory/db/laboratory`

### Task 2.2 — Helper Functions (Copy verbatim from ProductForm.tsx)

Copy these unchanged:
- `parseDimensions` (lines 88–92)
- `isPdfUrl` (lines 94–101)
- `getGemHue` (lines 74–86)
- `CertificateViewer` component (lines 104–131)
- `ImageViewer` component (lines 133–224)
- `VideoViewer` component (lines 226–313)

Constants to copy:
- `MAX_PRODUCT_IMAGES = 10`
- `MAX_PRODUCT_VIDEOS = 5`
- `SHAPES` array (line 58)

### Task 2.3 — Props Type

```ts
type Props = {
  mode: "create" | "edit"
  categories: CategoryRow[]
  laboratories: LaboratoryOption[]
  productId?: string
  initial?: Partial<PortalProductFormValues>
  backHref?: string
}
```

Remove the old `PortalProductFormValues` type and `EMPTY` constant — state is now per field with `useState`.

### Task 2.4 — State Declarations

Add all state fields inside the component:
```ts
// Form basics (controlled — needed for select/checkbox bindings)
const [productType, setProductType] = useState<"loose_stone"|"jewellery">(initial?.productType ?? "loose_stone")
const [isNegotiable, setIsNegotiable] = useState(initial?.isNegotiable ?? false)

// Visibility toggles
const [isFeatured, setIsFeatured] = useState(false)
const [isCollectorPiece, setIsCollectorPiece] = useState(false)
const [isPrivilegeAssist, setIsPrivilegeAssist] = useState(false)
const [isPromotion, setIsPromotion] = useState(false)

// Media
const [imageUrlsList, setImageUrlsList] = useState<string[]>(/* parse initial.imageUrls */)
const [videoUrlsList, setVideoUrlsList] = useState<string[]>(/* parse initial.videoUrls */)
const [uploadingImages, setUploadingImages] = useState(false)
const [uploadingVideos, setUploadingVideos] = useState(false)
const [uploadProgress, setUploadProgress] = useState(0)
const [uploadFileCount, setUploadFileCount] = useState(0)
const [uploadMediaType, setUploadMediaType] = useState<"image"|"video">("image")
const [uploadError, setUploadError] = useState<string|null>(null)
const [viewerIdx, setViewerIdx] = useState<number|null>(null)
const [videoViewerIdx, setVideoViewerIdx] = useState<number|null>(null)

// Certificate
const [certReportUrl, setCertReportUrl] = useState(initial?.certReportUrl ?? "")
const [uploadingCertificate, setUploadingCertificate] = useState(false)

// Dimensions (three-part)
const [dim1, setDim1] = useState(() => parseDimensions(initial?.dimensions)[0])
const [dim2, setDim2] = useState(() => parseDimensions(initial?.dimensions)[1])
const [dim3, setDim3] = useState(() => parseDimensions(initial?.dimensions)[2])

// Jewellery gemstones
const [jewelleryGemstones, setJewelleryGemstones] = useState<FormGemstoneEntry[]>([])
const [gemstoneDialogOpen, setGemstoneDialogOpen] = useState(false)
const [gemstoneDialogMode, setGemstoneDialogMode] = useState<"add"|"edit"|"view">("add")
const [gemstoneDialogIndex, setGemstoneDialogIndex] = useState<number|null>(null)
const [gemstoneDialogForm, setGemstoneDialogForm] = useState<FormGemstoneEntry>(emptyGemstone)

// UI
const [dirty, setDirty] = useState(false)
const [loading, setLoading] = useState(false)
const [notesTab, setNotesTab] = useState<"description"|"extra">("description")
```

`FormGemstoneEntry` type and `emptyGemstone` — copy verbatim from `ProductForm.tsx:824–840`.

### Task 2.5 — Upload Handlers

Copy verbatim from `ProductForm.tsx`:
- `handleUploadMedia` (lines 896–955) — unchanged, posts to `/api/upload/product-media`
- `handleUploadCertificate` (lines 957–983) — unchanged, posts to `/api/upload/certificate`
- Gemstone dialog handlers: `openAddGemstoneDialog`, `openEditGemstoneDialog`, `openViewGemstoneDialog`, `handleSaveGemstoneDialog`, `handleRemoveGemstone` (lines 861–893)

### Task 2.6 — handleSubmit

Replace old `handleSubmit`. Build the submission object and call the portal action:

```ts
async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault()
  setLoading(true)
  const form = e.currentTarget
  const fd = new FormData(form)

  const input: Record<string, unknown> = {
    title: fd.get("title"),
    sku: fd.get("sku"),
    description: fd.get("description"),
    productType,
    categoryId: fd.get("categoryId"),
    price: fd.get("price"),
    currency: fd.get("currency"),
    isNegotiable,
    identification: fd.get("identification"),
    // Visibility
    isFeatured,
    isCollectorPiece,
    isPrivilegeAssist,
    isPromotion,
    // Specs
    weightCarat: fd.get("weightCarat"),
    color: fd.get("color"),
    origin: fd.get("origin"),
    stoneCut: fd.get("stoneCut"),
    shape: fd.get("shape"),
    metal: fd.get("metal"),
    totalWeightGrams: fd.get("totalWeightGrams"),
    pieceCount: fd.get("pieceCount"),
    dimensions: [dim1, dim2, dim3].filter(Boolean).join(" × "),
    // Cert
    laboratoryId: fd.get("laboratoryId"),
    certReportNumber: fd.get("certReportNumber"),
    certReportDate: fd.get("certReportDate"),
    certReportUrl,
    additionalMemos: fd.get("additionalMemos"),
    // Media (arrays)
    imageUrls: imageUrlsList,
    videoUrls: videoUrlsList,
    // Jewellery gemstones
    jewelleryGemstones: productType === "jewellery"
      ? jewelleryGemstones.filter(g => g.categoryId && g.weightCarat.trim())
      : [],
  }

  try {
    const result = isEdit
      ? await updatePortalProductAction(productId!, input)
      : await createPortalProductAction(input)
    if (!result.ok) {
      toast.error("Failed to save", { description: result.error })
      return
    }
    setDirty(false)
    toast.success(isEdit ? "Changes saved" : "Product created")
    router.push("/portal/products")
    router.refresh()
  } catch {
    toast.error("An unexpected error occurred")
  } finally {
    setLoading(false)
  }
}
```

Note: `imageUrls` and `videoUrls` are passed as arrays directly — `normalizeProductBody` handles array→newline-string conversion already.

### Task 2.7 — JSX Structure

Build the return JSX with this structure (all using `pd-*` classes):

```
<div className="pd-host">

  {/* Sticky bar */}
  <div className="pd-stickybar">
    <div className="pd-topbar">
      <nav className="pd-breadcrumbs">
        <Link href={backHref ?? "/portal/products"}>← My products</Link>
        <ChevronRight />
        <span className="pd-here">{isEdit ? (initial title) : "New product"}</span>
      </nav>
      <div className="pd-topbar-spacer" />
    </div>
    <div className="pd-savebar">
      {dirty ? <span className="pd-savebar-dirty">...</span> : null}
      <span style={{flex:1}} />
      <Link href="/portal/products" className="pd-btn">Discard</Link>
      <button type="submit" form="portal-product-form" className="pd-btn pd-btn-primary" disabled={loading}>
        <Save size={13} /> {loading ? "Saving…" : isEdit ? "Save changes" : "Create product"}
      </button>
    </div>
  </div>

  {/* Main form — single column (no pd-grid/pd-side) */}
  <form id="portal-product-form" onSubmit={handleSubmit} onInput={() => setDirty(true)}>

    {/* Section 1: Images & videos */}
    — Copy from ProductForm.tsx:1303–1480 (the pd-sec for images)
    — Remove the "Upload image" button in pd-sec-tools (keep inline drop zones only)
    — Actually keep the header upload button — same as admin

    {/* Section 2: Basic info */}
    — Title, SKU, Identification (no moderation status field)

    {/* Section 3: Pricing */}
    — Price, Currency, Negotiable toggle (pd-negotiable)

    {/* Section 4: Visibility */}
    — Four pd-toggle checkboxes: Featured listing, Collector piece, Privilege Assist, Promotion
    — Copy from ProductForm.tsx:1483–1583 (remove feature duration/expiry sub-fields)

    {/* Section 5: Product type & category */}
    — Type, Category, Cut (loose_stone) / Metal (jewellery)
    — Gemstone list + Add button (jewellery only)
    — Copy from ProductForm.tsx:1824–2013

    {/* Section 6: Specifications */}
    — Copy from ProductForm.tsx:2016–2179
    — Origin: text <input> (not dropdown — no origins prop)

    {/* Section 7: Certification */}
    — Copy from ProductForm.tsx:2184–2261
    — certReportNumber, certReportDate text inputs
    — Lab dropdown using laboratories prop
    — CertificateViewer when certReportUrl is set
    — additionalMemos textarea

    {/* Section 8: Notes & description */}
    — Copy from ProductForm.tsx:2263–2319 (tabbed description / extra)

  </form>

  {/* Gemstone dialog */}
  — Copy from ProductForm.tsx:2467–2554

  {/* Image/video lightbox viewers */}
  — {viewerIdx !== null && <ImageViewer ... />}
  — {videoViewerIdx !== null && <VideoViewer ... />}

</div>
```

**Section 6 (Specifications) — Origin field change:**
Admin uses `<select>` with `origins` prop. Portal has no origins prop → use `<input type="text" name="origin">` instead. All other Specification fields copy verbatim.

### Verification

```bash
# TypeScript check
npx tsc --noEmit 2>&1 | grep PortalProductForm

# Grep for old shadcn imports that should be removed
grep -n "from \"@/components/ui/input\"\|from \"@/components/ui/textarea\"\|from \"@/components/ui/select\"" components/portal/PortalProductForm.tsx
# Should return nothing (all replaced by pd-* native inputs)
```

---

## Phase 3: Update Page Files

**Goal:** Remove header markup from both portal product pages (it moves into the form), add `getAllLaboratories()` fetch, pass new props.

### Task 3.1 — `app/portal/products/new/page.tsx`

```tsx
import { getAllCategories } from "@/features/categories/db/categories"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"
import PortalProductForm from "@/components/portal/PortalProductForm"

export default async function NewPortalProductPage() {
  const [categories, laboratories] = await Promise.all([
    getAllCategories(),
    getAllLaboratories(),
  ])
  return (
    <PortalProductForm
      mode="create"
      categories={categories}
      laboratories={laboratories}
    />
  )
}
```

Remove the `<div className="space-y-6">` wrapper and all the `<Link>` / `<h1>` / `<p>` header markup — that is now inside the form component.

### Task 3.2 — `app/portal/products/[id]/edit/page.tsx`

Add `getAllLaboratories()` to the existing `Promise.all`. Add `mode="edit"` and `laboratories={laboratories}` props to `<PortalProductForm>`. Remove the outer header markup.

The `initial` object mapping stays the same — add these new fields:
```ts
isFeatured: product.isFeatured,
isCollectorPiece: product.isCollectorPiece,
isPrivilegeAssist: product.isPrivilegeAssist,
isPromotion: product.isPromotion,
jewelleryGemstones: product.jewelleryGemstones ?? [],
```

### Verification

```bash
npx tsc --noEmit 2>&1 | grep "portal/products"
# Should be clean
```

---

## Phase 4: Verify End-to-End

### Task 4.1 — Run the dev server and test

```bash
npm run dev
```

Checklist:
- [ ] `/portal/products/new` loads — sticky bar visible, breadcrumb shows "My products > New product"
- [ ] Dirty dot appears on any field change
- [ ] Image upload works — thumbnail strip appears with lightbox on click
- [ ] Video upload works — play button thumbnail appears
- [ ] Certificate upload works — CertificateViewer shows with View/Remove buttons
- [ ] Visibility toggles (Featured, Collector, Privilege Assist, Promotion) check/uncheck
- [ ] Product type switch: Loose stone → jewellery changes Specifications section and shows gemstone area
- [ ] Gemstone dialog opens, can add/edit/view/remove gemstones (jewellery mode)
- [ ] Three-part dimensions inputs join correctly (inspect submitted value)
- [ ] Form submits successfully → redirects to `/portal/products`
- [ ] Edit page loads with existing values pre-populated (including visibility toggles)
- [ ] Visibility toggles actually save (check DB or re-open edit page)

### Task 4.2 — Type check

```bash
npx tsc --noEmit
npm run lint
```

Both must be clean before done.

---

## Anti-Patterns to Avoid

- Do NOT import from `@/components/ui/select` — use native `<select className="pd-select">` like admin
- Do NOT import from `@/components/ui/input` or `@/components/ui/textarea` — use `pd-input`, `pd-textarea`
- Do NOT add a sidebar (`pd-side`, `pd-grid`) — portal uses single column
- Do NOT add feature duration/expiry fields to Visibility section — admin-only
- Do NOT add Status or Moderation fields — admin-only
- Do NOT set `sellerId` in the form — portal action uses `session.user.id` automatically

---

## File Summary

| File | Phase | Change |
|---|---|---|
| `features/products/actions/portal-products.ts` | 1 | Remove visibility field stripping |
| `components/portal/PortalProductForm.tsx` | 2 | Full rewrite |
| `app/portal/products/new/page.tsx` | 3 | Simplify, add labs fetch |
| `app/portal/products/[id]/edit/page.tsx` | 3 | Simplify, add labs fetch + new props |
