# Product Form Colour Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text Color input in the admin product form with a `colorId` dropdown fed by the managed colour list; server actions resolve the id and write both `colorId` and the denormalized colour name.

**Architecture:** The form mirrors the existing Laboratory dropdown (submit the uuid, `name="colorId"`); the two server actions mirror the mobile API's resolve-and-denormalize logic (`getColorById` → name into `color`, unknown id → friendly error). Pages fetch `getAllColors()` and pass a `colors` prop exactly like `origins`/`laboratories`. The DB layer already threads `colorId` — untouched.

**Tech Stack:** Next.js 16 server actions + FormData, Zod (fields already exist), Drizzle (no changes), Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-06-product-form-color-dropdown-design.md`.
- Product-level colour only — jewellery gemstone row colour boxes stay free text; do not touch them.
- Link/text invariant: when `colorId` is set, `color` is the resolved name; when the select is empty/absent, BOTH are null.
- Error message for a stale/unknown id: exactly `"Unknown colorId"`.
- No DB-layer or Zod-schema changes (`productCreateSchema`/`productUpdateSchema` already accept nullable uuid `colorId`; `createProductInDb`/`updateProductInDb` already accept `colorId`).
- Pre-commit hook runs lint; repo baseline: pre-existing tsc errors confined to 5 unrelated test files, 19 pre-existing test failures in unrelated suites — the bar is "no NEW errors/failures".

---

### Task 1: Server actions resolve colorId (+ unit tests)

**Files:**
- Modify: `features/products/actions/products.ts` (createProductAction ~line 55-160, updateProductAction ~line 164-300)
- Test: `tests/unit/product-actions-color.test.ts`

**Interfaces:**
- Consumes: `getColorById(id): Promise<{ id, name, hexCode, createdAt, updatedAt } | null>` from `@/features/colors/db/color`; existing Zod fields `colorId` (nullable uuid) on both product schemas; `createProductInDb`/`updateProductInDb` accept `colorId?: string | null`.
- Produces: both actions accept a `colorId` FormData field; Task 2's form relies on `name="colorId"` and on `{ error: "Unknown colorId" }` for stale ids.

- [ ] **Step 1: Write the failing tests**

`tests/unit/product-actions-color.test.ts` (mock scaffolding modeled on `tests/unit/create-product-verified-action.test.ts`, plus the colours db mock and a `db.select` chain that supports `.limit(1)` for the update action's current-row lookup):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/features/products/db/products", () => ({
  createProductInDb: vi.fn().mockResolvedValue("prod-new-1"),
  updateProductInDb: vi.fn().mockResolvedValue(undefined),
  deleteProductInDb: vi.fn().mockResolvedValue(undefined),
  verifyProductInDb: vi.fn().mockResolvedValue(undefined),
  unverifyProductInDb: vi.fn().mockResolvedValue(undefined),
}))

// db.select().from().where().limit(1) must resolve the current product row
// for updateProductAction's featured-points lookup.
const currentRow = {
  sellerId: "seller-1",
  isFeatured: false,
  featured: 0,
  featuredDurationDays: 0,
  featuredExpiresAt: null,
}
vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([currentRow]),
        })),
      })),
    })),
    transaction: vi.fn(),
  },
}))

vi.mock("@/lib/action-guard", () => ({
  requireActionRole: vi.fn().mockResolvedValue({ user: { id: "admin-1", role: "admin" } }),
}))

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), cacheTag: vi.fn(), updateTag: vi.fn() }))

vi.mock("@/features/products/db/cache/products", () => ({
  revalidateProductsCache: vi.fn(),
}))

vi.mock("@/features/points/db/points", () => ({
  deductUserPoints: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock("@/features/company-settings/db/company-settings", () => ({
  getCompanySettings: vi.fn().mockResolvedValue(null),
}))

vi.mock("@/features/users/db/users", () => ({
  searchUsersForPicker: vi.fn().mockResolvedValue([]),
  getRecentUsersForPicker: vi.fn().mockResolvedValue([]),
  getUsersPaginatedFromDb: vi.fn().mockResolvedValue({ users: [], total: 0 }),
}))

vi.mock("@/features/colors/db/color", () => ({
  getColorById: vi.fn(),
}))

import { createProductAction, updateProductAction } from "@/features/products/actions/products"
import { createProductInDb, updateProductInDb } from "@/features/products/db/products"
import { getColorById } from "@/features/colors/db/color"

const VALID_CATEGORY_ID = "3f2f1a10-1111-4a2b-8c3d-9e8f7a6b5c4d"
const COLOR_UUID = "b2c3d4e5-f6a7-4890-b123-456789012345"
const PRODUCT_UUID = "a1b2c3d4-e5f6-4789-a012-345678901234"

const royalBlue = {
  id: COLOR_UUID,
  name: "Royal Blue",
  hexCode: "#002366",
  createdAt: new Date(),
  updatedAt: new Date(),
}

function createFd(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set("title", "Test Sapphire")
  fd.set("price", "100")
  fd.set("categoryId", VALID_CATEGORY_ID)
  fd.set("productType", "loose_stone")
  fd.set("weightCarat", "1.5")
  fd.set("origin", "Myanmar")
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v)
  return fd
}

function updateFd(overrides: Record<string, string> = {}): FormData {
  const fd = createFd(overrides)
  fd.set("productId", PRODUCT_UUID)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("createProductAction with colorId", () => {
  // Validates resolve-and-denormalize: a known colorId stores the id AND
  // writes the colour's name into the color text column.
  it("resolves colorId and denormalizes the name", async () => {
    vi.mocked(getColorById).mockResolvedValue(royalBlue)
    const result = await createProductAction(createFd({ colorId: COLOR_UUID }))
    expect(result).toEqual({ success: true, productId: "prod-new-1" })
    expect(createProductInDb).toHaveBeenCalledWith(
      expect.objectContaining({ colorId: COLOR_UUID, color: "Royal Blue" })
    )
  })

  // Validates the stale-id path: colour deleted between page load and submit
  // → friendly error, nothing persisted.
  it("returns Unknown colorId for a stale id and persists nothing", async () => {
    vi.mocked(getColorById).mockResolvedValue(null)
    const result = await createProductAction(createFd({ colorId: COLOR_UUID }))
    expect(result).toEqual({ error: "Unknown colorId" })
    expect(createProductInDb).not.toHaveBeenCalled()
  })

  // Validates that a loose stone without any colour is rejected by the
  // existing Zod rule (colorId satisfies the requirement; absence fails).
  it("rejects a loose stone with neither colorId nor color", async () => {
    const result = await createProductAction(createFd())
    expect(result).toHaveProperty("error")
    expect(createProductInDb).not.toHaveBeenCalled()
    expect(getColorById).not.toHaveBeenCalled()
  })
})

describe("updateProductAction with colorId", () => {
  // Validates resolve-and-denormalize on update.
  it("resolves colorId and denormalizes the name", async () => {
    vi.mocked(getColorById).mockResolvedValue(royalBlue)
    const result = await updateProductAction(updateFd({ colorId: COLOR_UUID }))
    expect(result).toEqual(expect.objectContaining({ success: true }))
    expect(updateProductInDb).toHaveBeenCalledWith(
      PRODUCT_UUID,
      expect.objectContaining({ colorId: COLOR_UUID, color: "Royal Blue" }),
      expect.anything()
    )
  })

  // Validates the link/text invariant: jewellery submits (no colorId field
  // rendered) clear both columns together — colorId null AND color null.
  it("clears both colorId and color when the select is absent (jewellery)", async () => {
    const fd = updateFd({ productType: "jewellery" })
    const result = await updateProductAction(fd)
    expect(result).toEqual(expect.objectContaining({ success: true }))
    expect(updateProductInDb).toHaveBeenCalledWith(
      PRODUCT_UUID,
      expect.objectContaining({ colorId: null, color: null }),
      expect.anything()
    )
    expect(getColorById).not.toHaveBeenCalled()
  })

  // Validates the stale-id path on update.
  it("returns Unknown colorId on update and persists nothing", async () => {
    vi.mocked(getColorById).mockResolvedValue(null)
    const result = await updateProductAction(updateFd({ colorId: COLOR_UUID }))
    expect(result).toEqual({ error: "Unknown colorId" })
    expect(updateProductInDb).not.toHaveBeenCalled()
  })
})
```

Note on the jewellery-update test: `createFd` sets no `colorId` and jewellery skips the loose-stone colour requirement, so parsing succeeds with `colorId: null` — asserting the invariant that both columns are cleared together.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/product-actions-color.test.ts`
Expected: FAIL — `createProductInDb` receives no `colorId`/denormalized name (field parsed nowhere), and no `Unknown colorId` error path exists. (The "rejects a loose stone with neither" case may already pass — the Zod rule ships already.)

- [ ] **Step 3: Implement colorId resolution in both actions**

In `features/products/actions/products.ts`:

1. Add import:

```ts
import { getColorById } from "@/features/colors/db/color"
```

2. **createProductAction** — in the `productCreateSchema.safeParse({...})` object, directly after the `color:` line, add:

```ts
    colorId: emptyToNull(formData.get("colorId")),
```

3. After the `requireActionRole` check (and before the points deduction), add:

```ts
  let resolvedColor = parsed.data.color ?? null
  if (parsed.data.colorId) {
    const colorRow = await getColorById(parsed.data.colorId)
    if (!colorRow) {
      return { error: "Unknown colorId" }
    }
    resolvedColor = colorRow.name
  }
```

4. In the `createProductInDb({...})` argument object, change the `color:` line and add `colorId:` beside it:

```ts
    color: resolvedColor,
    colorId: parsed.data.colorId ?? null,
```

5. **updateProductAction** — same three edits: `colorId: emptyToNull(formData.get("colorId")),` after the `color:` parse line; the same resolution block after the session check (using `parsed.data`, placed before the `const { productId, ...data } = parsed.data` destructure); and in the `updateProductInDb(productId, {...})` payload change/add:

```ts
      color: data.colorId ? resolvedColor : data.color,
      colorId: data.colorId ?? null,
```

(`data.color` is `emptyToNull(...)` = null when the form has no colour input, so an empty select yields `color: null, colorId: null` — the invariant.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/product-actions-color.test.ts && npx vitest run tests/unit/create-product-verified-action.test.ts tests/unit/verify-product-action.test.ts`
Expected: all PASS (the two existing action suites guard against regressions).

- [ ] **Step 5: Commit**

```bash
git add features/products/actions/products.ts tests/unit/product-actions-color.test.ts
git commit -m "feat: resolve colorId in product create/update server actions"
```

---

### Task 2: Colour dropdown in ProductForm + pages + docs

**Files:**
- Modify: `features/products/components/ProductForm.tsx` (props ~line 710-745; colour input ~line 2210-2224)
- Modify: `app/admin/products/new/page.tsx`
- Modify: `app/admin/products/[id]/edit/page.tsx`
- Create: `docs/technical/product-form-color-dropdown.md`
- Modify: `docs/guides/product-colors.md` (replace the "web form still free-text" follow-up note)

**Interfaces:**
- Consumes: `getAllColors(): Promise<ColorOption[]>` and `type ColorOption` from `@/features/colors/db/color`; Task 1's `name="colorId"` FormData contract; `product.colorId: string | null` on `ProductForEdit` (already present).
- Produces: `ProductForm` prop `colors?: ColorOption[] | null`.

- [ ] **Step 1: Add the `colors` prop to ProductForm**

In `features/products/components/ProductForm.tsx`:

1. Add the type import beside the laboratory one:

```ts
import type { ColorOption } from "@/features/colors/db/color"
```

2. In `type Props`, after `laboratories?: LaboratoryOption[] | null`, add:

```ts
  colors?: ColorOption[] | null
```

3. Destructure `colors,` in the `ProductForm({ ... })` parameter list after `laboratories,`.

- [ ] **Step 2: Replace the free-text colour input with the select**

Replace this block (in the stone-details section, ~line 2210):

```tsx
                  <div className="pd-field">
                    <label htmlFor="color" className="pd-label">
                      Color <span className="req">*</span>
                    </label>
                    <input
                      id="color"
                      name="color"
                      type="text"
                      required
                      maxLength={100}
                      defaultValue={product?.color ?? ""}
                      placeholder="e.g. Pigeon Blood Red"
                      className="pd-input"
                    />
                  </div>
```

with:

```tsx
                  <div className="pd-field">
                    <label htmlFor="colorId" className="pd-label">
                      Color <span className="req">*</span>
                    </label>
                    <select
                      id="colorId"
                      name="colorId"
                      required
                      defaultValue={
                        product?.colorId ??
                        (product?.color
                          ? (colors ?? []).find(
                              (c) => c.name.toLowerCase() === product.color!.toLowerCase()
                            )?.id ?? ""
                          : "")
                      }
                      className="pd-select"
                    >
                      <option value="">Select color</option>
                      {(colors ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
```

(Pre-selection: `colorId` when set; legacy free-text products match by case-insensitive name; otherwise empty.)

- [ ] **Step 3: Feed colours from both pages**

`app/admin/products/new/page.tsx`:

```ts
import { getAllColors } from "@/features/colors/db/color"
```

after `const origins = await getAllOrigins()` add:

```ts
  const colors = await getAllColors()
```

and pass `colors={colors}` to `<ProductForm ...>` after `origins={origins}`.

`app/admin/products/[id]/edit/page.tsx`: add the same import; extend the existing `Promise.all` destructure:

```ts
  const [product, categories, laboratories, origins, colors, featureSettings, companySettings] = await Promise.all([
    getProductById(id),
    getAllCategories(),
    getAllLaboratories(),
    getAllOrigins(),
    getAllColors(),
    getFeatureSettings(),
    getCompanySettings(),
  ])
```

and pass `colors={colors}` to `<ProductForm ...>` after `origins={origins}`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — no NEW errors (baseline: 5 unrelated test files).
Run: `npm run test` — no NEW failures (baseline: 19).
Optional if the environment allows: `npm run dev`, open `/admin/products/new`, confirm the Color dropdown lists the 20 seeded colours and is required for loose stones.

- [ ] **Step 5: Write the docs**

`docs/technical/product-form-color-dropdown.md` — follow the structure of `docs/technical/product-colors.md`:
- **What changed:** the four files above; colour input → `colorId` select.
- **Data flow:** page `getAllColors()` → `colors` prop → select submits uuid → action resolves via `getColorById` → `createProductInDb`/`updateProductInDb` store `colorId` + denormalized `color` name.
- **Auth:** unchanged (admin session actions).
- **Edge cases:** stale id → "Unknown colorId" error; legacy free-text products pre-select by case-insensitive name match, else must re-pick; jewellery products don't render the select → both columns cleared on update (link/text invariant); jewellery gemstone rows remain free text by design.

`docs/guides/product-colors.md` — find the follow-up/limitation sentence saying the web product form still uses free text; replace it with a short paragraph: the admin product form now uses a colour dropdown fed by the managed list (name `colorId`), and legacy free-text values pre-select by name match when possible.

- [ ] **Step 6: Commit**

```bash
git add features/products/components/ProductForm.tsx app/admin/products/new/page.tsx "app/admin/products/[id]/edit/page.tsx" docs/technical/product-form-color-dropdown.md docs/guides/product-colors.md
git commit -m "feat: use managed colour dropdown in admin product form"
```
