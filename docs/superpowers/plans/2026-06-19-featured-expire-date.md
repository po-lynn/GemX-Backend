# Featured Expire Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins set an exact expiry date when featuring a product — tier dropdown auto-fills the date, admin can override it freely.

**Architecture:** The date input submits `featuredExpiresAt` (YYYY-MM-DD) alongside the existing tier fields. The Zod update schema coerces it to `Date | null`. The server action forwards it to `updateProductInDb`, which stores it directly instead of auto-calculating from `featureDurationDays`. The `ProductForEdit` type already returns `featuredExpiresAt: Date | null` so the form can pre-fill from saved data.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, Zod, React 19, TypeScript 5, Vitest

## Global Constraints

- Never run `db:generate`, `db:migrate`, or `db:push` — user applies migrations manually
- No schema migration needed — `featuredExpiresAt` column already exists on the `product` table
- Test runner: `npm run test` (full suite); `npm run test:unit` (unit only)
- Path alias `@/*` maps to the repo root

---

### Task 1: Extend Zod update schema + `UpdateProductInput` type

**Files:**
- Modify: `features/products/schemas/products.ts:254-274`
- Modify: `features/products/db/products.ts:888-936` (`UpdateProductInput` type)
- Create: `tests/unit/featured-expire-date-schema.test.ts`

**Interfaces:**
- Produces: `productUpdateSchema` accepts `featuredExpiresAt: Date | null | undefined`
- Produces: `UpdateProductInput.featuredExpiresAt?: Date | null`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/featured-expire-date-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { productUpdateSchema } from "@/features/products/schemas/products"

const BASE = { productId: "a1b2c3d4-e5f6-4789-a012-345678901234" }

describe("productUpdateSchema — featuredExpiresAt", () => {
  it("coerces a YYYY-MM-DD string to a Date", () => {
    const out = productUpdateSchema.parse({ ...BASE, featuredExpiresAt: "2026-07-19" })
    // Zod coerces the string to a Date object
    expect(out.featuredExpiresAt).toBeInstanceOf(Date)
    expect(out.featuredExpiresAt?.toISOString().slice(0, 10)).toBe("2026-07-19")
  })

  it("accepts null (indefinite featured)", () => {
    const out = productUpdateSchema.parse({ ...BASE, featuredExpiresAt: null })
    expect(out.featuredExpiresAt).toBeNull()
  })

  it("treats missing field as undefined (field not updated)", () => {
    const out = productUpdateSchema.parse({ ...BASE })
    expect(out.featuredExpiresAt).toBeUndefined()
  })

  it("treats empty string as null", () => {
    const out = productUpdateSchema.parse({ ...BASE, featuredExpiresAt: "" })
    expect(out.featuredExpiresAt).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:unit -- featured-expire-date-schema
```

Expected: FAIL — `productUpdateSchema` does not yet have `featuredExpiresAt`.

- [ ] **Step 3: Add `featuredExpiresAt` to the Zod update schema**

In `features/products/schemas/products.ts`, `productUpdateSchema` is at line 254. It uses `.extend({ productId: z.string().uuid() })`. Add `featuredExpiresAt` to that extend block:

```ts
// BEFORE (lines 254-258):
export const productUpdateSchema = productCreateBaseSchema
  .partial()
  .extend({
    productId: z.string().uuid(),
  })

// AFTER:
export const productUpdateSchema = productCreateBaseSchema
  .partial()
  .extend({
    productId: z.string().uuid(),
    featuredExpiresAt: z
      .preprocess(
        (v) => (!v || v === "" ? null : v),
        z.coerce.date().nullable()
      )
      .optional(),
  })
```

- [ ] **Step 4: Add `featuredExpiresAt` to `UpdateProductInput` type**

In `features/products/db/products.ts`, `UpdateProductInput` is at line 888. After `featureDurationDays?: number` (line 929), add:

```ts
  featureDurationDays?: number
  featuredExpiresAt?: Date | null    // ← add this line
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test:unit -- featured-expire-date-schema
```

Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add features/products/schemas/products.ts features/products/db/products.ts tests/unit/featured-expire-date-schema.test.ts
git commit -m "feat: add featuredExpiresAt to update schema and UpdateProductInput type"
```

---

### Task 2: Update DB layer to accept `featuredExpiresAt` directly

**Files:**
- Modify: `features/products/db/products.ts:1006-1017`

**Interfaces:**
- Consumes: `UpdateProductInput.featuredExpiresAt?: Date | null` (from Task 1)
- Produces: `updateProductInDb` stores `featuredExpiresAt` directly; clears it when `isFeatured` is false

- [ ] **Step 1: Replace the auto-calculation block**

In `features/products/db/products.ts`, find lines 1006–1017:

```ts
// CURRENT (lines 1006-1017):
if (rest.isFeatured !== undefined) updates.isFeatured = rest.isFeatured
if (rest.featured !== undefined) updates.featured = rest.featured
if (rest.featureDurationDays !== undefined) {
  const days = Math.min(365, Math.max(0, Math.floor(rest.featureDurationDays) || 0))
  updates.featuredDurationDays = days
  const isFeaturedNext =
    rest.isFeatured ?? updates.isFeatured ?? false
  updates.featuredExpiresAt =
    isFeaturedNext && days > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      : null
}
```

Replace with:

```ts
if (rest.isFeatured !== undefined) updates.isFeatured = rest.isFeatured
if (rest.featured !== undefined) updates.featured = rest.featured
if (rest.featureDurationDays !== undefined) {
  const days = Math.min(365, Math.max(0, Math.floor(rest.featureDurationDays) || 0))
  updates.featuredDurationDays = days
}
// Resolve whether the product will be featured after this update
const isFeaturedNext = rest.isFeatured !== undefined ? rest.isFeatured : (updates.isFeatured ?? false)
if (!isFeaturedNext) {
  // Unfeaturing always clears the expiry
  updates.featuredExpiresAt = null
} else if (rest.featuredExpiresAt !== undefined) {
  // Use the exact date the admin set (may be null = indefinite)
  updates.featuredExpiresAt = rest.featuredExpiresAt
}
// If isFeatured remains true and no new expiry was submitted, leave existing expiry untouched
```

- [ ] **Step 2: Run the full test suite to check for regressions**

```bash
npm run test
```

Expected: all tests PASS (no product tests depend on the auto-calc behaviour).

- [ ] **Step 3: Commit**

```bash
git add features/products/db/products.ts
git commit -m "feat: updateProductInDb accepts featuredExpiresAt directly, drops auto-calc from duration"
```

---

### Task 3: Wire `featuredExpiresAt` through the server action

**Files:**
- Modify: `features/products/actions/products.ts`

**Interfaces:**
- Consumes: `productUpdateSchema.featuredExpiresAt` (Task 1), `UpdateProductInput.featuredExpiresAt` (Task 1)
- Produces: `updateProductAction` reads `featuredExpiresAt` from formData and forwards it to `updateProductInDb`

- [ ] **Step 1: Add the form-data reader**

In `features/products/actions/products.ts`, after the existing `featureDurationDaysFromForm` function (around line 52), add:

```ts
function featuredExpiresAtFromForm(fd: FormData): string | null {
  const raw = fd.get("featuredExpiresAt")
  if (raw === null) return null
  const s = String(raw).trim()
  return s === "" ? null : s
}
```

This returns the raw date string (e.g. `"2026-07-19"`) or `null` for empty/missing. Zod's `z.preprocess` in the schema handles the coercion to `Date | null`.

- [ ] **Step 2: Add to the `updateProductAction` parse call**

In `updateProductAction`, find the `safeParse` call (around line 192–200). After `featureDurationDays: featureDurationDaysFromForm(formData),` add:

```ts
    featureDurationDays: featureDurationDaysFromForm(formData),
    featuredExpiresAt: featuredExpiresAtFromForm(formData),  // ← add this line
```

- [ ] **Step 3: Add to the `updateProductInDb` call**

In the same function, find the `updateProductInDb` call (around lines 236–276). After `featureDurationDays: data.featureDurationDays,` add:

```ts
      featureDurationDays: data.featureDurationDays,
      featuredExpiresAt: data.featuredExpiresAt,            // ← add this line
```

- [ ] **Step 4: Run tests**

```bash
npm run test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add features/products/actions/products.ts
git commit -m "feat: forward featuredExpiresAt from formData through updateProductAction"
```

---

### Task 4: Add expire date input to ProductForm

**Files:**
- Modify: `features/products/components/ProductForm.tsx`

**Interfaces:**
- Consumes: `product.featuredExpiresAt: Date | null` (already in `ProductForEdit` — no change needed)
- Consumes: `selectedFeatureTier: string` (existing state, format `"durationDays:points"`)
- Produces: `<input name="featuredExpiresAt" type="date">` submitted with the form

- [ ] **Step 1: Add state for the expire date string**

In `ProductForm.tsx`, find the existing `selectedFeatureTier` state (around line 736). Directly below it, add:

```ts
const [featuredExpiresAtStr, setFeaturedExpiresAtStr] = useState<string>(() => {
  if (!product?.featuredExpiresAt) return ""
  return new Date(product.featuredExpiresAt).toISOString().slice(0, 10)
})
```

- [ ] **Step 2: Add a useEffect to sync when the product changes**

Find the `useEffect` block for `isFeatured` (around line 779):

```ts
useEffect(() => {
  setIsFeatured(product?.isFeatured ?? false)
}, [product?.id, product?.isFeatured])
```

Directly below it, add:

```ts
useEffect(() => {
  if (!product?.featuredExpiresAt) {
    setFeaturedExpiresAtStr("")
    return
  }
  setFeaturedExpiresAtStr(new Date(product.featuredExpiresAt).toISOString().slice(0, 10))
}, [product?.id, product?.featuredExpiresAt])
```

- [ ] **Step 3: Add a useEffect to auto-fill date when tier changes**

After the effect in Step 2, add:

```ts
useEffect(() => {
  if (!selectedFeatureTier) return
  const days = Number(selectedFeatureTier.split(":")[0])
  if (!Number.isFinite(days) || days <= 0) return
  const expiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  setFeaturedExpiresAtStr(expiry.toISOString().slice(0, 10))
}, [selectedFeatureTier])
```

This fires whenever the admin picks a different tier, overwriting the date input with today + durationDays. Admin can then manually adjust the date after selecting a tier.

- [ ] **Step 4: Add the date input to the form**

In the `{isFeatured && ...}` feature-duration block (around line 1539–1596), after the closing `</div>` of the tier field (after line 1596), add:

```tsx
{/* Feature expire date */}
{isFeatured && (
  <div className="pd-field" style={{ maxWidth: 380 }}>
    <label className="pd-label">
      Expires on{" "}
      <span className="pd-label-hint">leave blank for indefinite</span>
    </label>
    <input
      className="pd-input"
      type="date"
      name="featuredExpiresAt"
      value={featuredExpiresAtStr}
      onChange={(e) => setFeaturedExpiresAtStr(e.target.value)}
    />
  </div>
)}
```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6: Run full test suite**

```bash
npm run test
```

Expected: all tests PASS.

- [ ] **Step 7: Manual verification**

Open `http://localhost:3000/admin/products/74a15874-70cf-4af2-9173-8024219744af/edit?page=1`:

1. Scroll to the Visibility section
2. Check "Featured listing" — the tier dropdown and a new "Expires on" date field should appear
3. Select a tier — confirm the date input auto-fills with today + tier days
4. Manually change the date to a different date
5. Save — confirm no error toast
6. Reload the page — confirm the date input shows the saved date

- [ ] **Step 8: Commit**

```bash
git add features/products/components/ProductForm.tsx
git commit -m "feat: show editable expire date in ProductForm when product is featured"
```
