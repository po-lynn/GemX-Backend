# GemX Verified Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `isVerified` boolean flag to products that RBAC-permissioned staff can toggle to signal physical authentication — displayed as a "GemX Verified" badge in the admin list view, web homepage cards, and mobile API response.

**Architecture:** Boolean flag pattern on the `products` table (same as `isCollectorPiece`, `isFeatured`). A dedicated `verifyProductAction` server action — gated on a new `products.verify` RBAC permission key — handles the toggle, enforces the `moderationStatus = 'approved'` business rule, and writes audit entries to the existing `productAdminChangeLog` table. The ProductForm calls this action immediately on toggle change (not as part of the main save).

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (PostgreSQL/Supabase), Better Auth, React 19

## Global Constraints

- Migration is generated via `npm run db:generate` — **do not run `db:migrate` or `db:push`**; the user applies migrations manually
- `verifiedBy` references `user.id` with `ON DELETE SET NULL`
- `isVerified` can only be set to `true` when `moderationStatus = 'approved'`; the server action enforces this — client-side disable is UX only
- The toggle is **hidden entirely** (not disabled) when the current user lacks `products.verify` permission
- Change log entries use `productAdminChangeLog` with `changeType: "verified"`

---

### Task 1: Database Schema — Add Verified Columns

**Files:**
- Modify: `drizzle/schema/product-schema.ts`
- Create: migration file (auto-generated)

**Interfaces:**
- Produces: `isVerified: boolean`, `verifiedAt: timestamp | null`, `verifiedBy: text | null` on `products` table; `"verified"` value in `productAdminChangeTypeEnum`

- [ ] **Step 1: Add "verified" to productAdminChangeTypeEnum**

Find `productAdminChangeTypeEnum` at lines 56–64 of `drizzle/schema/product-schema.ts`. Add `"verified"`:

```typescript
export const productAdminChangeTypeEnum = pgEnum("product_admin_change_type", [
  "status",
  "price",
  "featured",
  "seller",
  "collector_piece",
  "piece_count",
  "privilege_assist",
  "verified",
]);
```

- [ ] **Step 2: Add three columns to the products table**

After `isPromotion` (line 126), add:

```typescript
isVerified: boolean("is_verified").notNull().default(false),
verifiedAt: timestamp("verified_at"),
verifiedBy: text("verified_by").references(() => user.id, { onDelete: "set null" }),
```

- [ ] **Step 3: Generate migration**

```bash
npm run db:generate
```

Expected: new `.sql` file in `drizzle/migrations/`. Confirm it contains:
```sql
ALTER TABLE "product" ADD COLUMN "is_verified" boolean DEFAULT false NOT NULL;
ALTER TABLE "product" ADD COLUMN "verified_at" timestamp;
ALTER TABLE "product" ADD COLUMN "verified_by" text;
```

**Do not run `db:migrate` or `db:push`.**

- [ ] **Step 4: Commit**

```bash
git add drizzle/schema/product-schema.ts drizzle/migrations/
git commit -m "feat: add is_verified, verified_at, verified_by columns to products"
```

---

### Task 2: DB Query Layer — Types, Queries, and Mutation Helpers

**Files:**
- Modify: `features/products/db/products.ts`
- Create: `tests/unit/products-verify-db.test.ts`

**Interfaces:**
- Consumes: `isVerified`, `verifiedAt`, `verifiedBy` columns from Task 1
- Produces:
  - `AdminProductRow.isVerified: boolean`
  - `AdminProductRow.verifiedAt: Date | null`
  - `AdminProductRow.verifiedBy: string | null`
  - `verifyProductInDb(productId: string, adminId: string): Promise<void>`
  - `unverifyProductInDb(productId: string, adminId: string): Promise<void>`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/products-verify-db.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockSet = vi.fn().mockReturnThis()
const mockWhere = vi.fn().mockResolvedValue([{ isVerified: false }])
const mockValues = vi.fn().mockResolvedValue([])
const mockUpdate = vi.fn(() => ({ set: mockSet }))
const mockInsert = vi.fn(() => ({ values: mockValues }))
const mockSelect = vi.fn(() => ({
  from: vi.fn(() => ({ where: mockWhere })),
}))

vi.mock("@/lib/db", () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  },
}))

vi.mock("@/drizzle/schema", () => ({
  product: { id: "id", isVerified: "is_verified" },
  productAdminChangeLog: {},
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockSet.mockReturnThis()
  mockWhere.mockResolvedValue([{ isVerified: false }])
})

describe("verifyProductInDb", () => {
  it("updates product with isVerified=true, verifiedAt, and verifiedBy", async () => {
    const { verifyProductInDb } = await import("@/features/products/db/products")
    await verifyProductInDb("prod-1", "admin-1")
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ isVerified: true, verifiedBy: "admin-1" })
    )
  })

  it("inserts a verified change log entry with oldValue false and newValue true", async () => {
    const { verifyProductInDb } = await import("@/features/products/db/products")
    await verifyProductInDb("prod-1", "admin-1")
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ changeType: "verified", oldValue: "false", newValue: "true", actorId: "admin-1" })
    )
  })
})

describe("unverifyProductInDb", () => {
  it("clears isVerified, verifiedAt, and verifiedBy when product was verified", async () => {
    mockWhere.mockResolvedValueOnce([{ isVerified: true }])
    const { unverifyProductInDb } = await import("@/features/products/db/products")
    await unverifyProductInDb("prod-1", "admin-1")
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ isVerified: false, verifiedAt: null, verifiedBy: null })
    )
  })

  it("skips update when product is already unverified", async () => {
    mockWhere.mockResolvedValueOnce([{ isVerified: false }])
    const { unverifyProductInDb } = await import("@/features/products/db/products")
    await unverifyProductInDb("prod-1", "admin-1")
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("inserts a verified change log entry with oldValue true and newValue false", async () => {
    mockWhere.mockResolvedValueOnce([{ isVerified: true }])
    const { unverifyProductInDb } = await import("@/features/products/db/products")
    await unverifyProductInDb("prod-1", "admin-1")
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ changeType: "verified", oldValue: "true", newValue: "false" })
    )
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:unit -- products-verify-db
```

Expected: FAIL — `verifyProductInDb is not a function`

- [ ] **Step 3: Add fields to AdminProductRow type**

In `features/products/db/products.ts`, find `AdminProductRow` type (around line 96). Add after `isPromotion`:

```typescript
isVerified: boolean
verifiedAt: Date | null
verifiedBy: string | null
```

- [ ] **Step 4: Add fields to ProductForEdit type**

Find `ProductForEdit` type (around line 586). Add the same three fields:

```typescript
isVerified: boolean
verifiedAt: Date | null
verifiedBy: string | null
```

- [ ] **Step 5: Add fields to SELECT clauses**

In `getAdminProductsFromDb` (around line 260) and `getProductForEdit` query, add to the selection object after `isPromotion`:

```typescript
isVerified: product.isVerified,
verifiedAt: product.verifiedAt,
verifiedBy: product.verifiedBy,
```

- [ ] **Step 6: Add verifyProductInDb**

At the bottom of `features/products/db/products.ts`, add:

```typescript
export async function verifyProductInDb(productId: string, adminId: string): Promise<void> {
  const [prev] = await db
    .select({ isVerified: product.isVerified })
    .from(product)
    .where(eq(product.id, productId))

  await db
    .update(product)
    .set({ isVerified: true, verifiedAt: new Date(), verifiedBy: adminId })
    .where(eq(product.id, productId))

  await db.insert(productAdminChangeLog).values({
    productId,
    changeType: "verified",
    oldValue: String(prev?.isVerified ?? false),
    newValue: "true",
    actorId: adminId,
  })
}
```

- [ ] **Step 7: Add unverifyProductInDb**

```typescript
export async function unverifyProductInDb(productId: string, adminId: string): Promise<void> {
  const [prev] = await db
    .select({ isVerified: product.isVerified })
    .from(product)
    .where(eq(product.id, productId))

  if (!prev?.isVerified) return

  await db
    .update(product)
    .set({ isVerified: false, verifiedAt: null, verifiedBy: null })
    .where(eq(product.id, productId))

  await db.insert(productAdminChangeLog).values({
    productId,
    changeType: "verified",
    oldValue: "true",
    newValue: "false",
    actorId: adminId,
  })
}
```

- [ ] **Step 8: Run tests to confirm they pass**

```bash
npm run test:unit -- products-verify-db
```

Expected: 5 passing

- [ ] **Step 9: Commit**

```bash
git add features/products/db/products.ts tests/unit/products-verify-db.test.ts
git commit -m "feat: add isVerified fields to product queries and verify/unverify db helpers"
```

---

### Task 3: RBAC Permission Key

**Files:**
- Modify: `features/rbac/feature-keys.ts`

**Interfaces:**
- Produces: `FEATURE_KEYS.PRODUCTS_VERIFY = "products.verify"` — consumed by Task 4's server action and Task 5's form permission check

- [ ] **Step 1: Add permission key to FEATURE_KEYS**

In `features/rbac/feature-keys.ts`, add to the `FEATURE_KEYS` object:

```typescript
PRODUCTS_VERIFY: "products.verify",
```

- [ ] **Step 2: Add to Marketplace group in RBAC registry**

Find the Marketplace feature group array (around line 36) and add:

```typescript
{ key: FEATURE_KEYS.PRODUCTS_VERIFY, label: "Verify Products" },
```

- [ ] **Step 3: Commit**

```bash
git add features/rbac/feature-keys.ts
git commit -m "feat: add products.verify RBAC permission key"
```

---

### Task 4: Server Action — verifyProductAction + Moderation Auto-Clear

**Files:**
- Modify: `features/products/actions/products.ts`
- Create: `tests/unit/verify-product-action.test.ts`

**Interfaces:**
- Consumes: `verifyProductInDb(productId, adminId)`, `unverifyProductInDb(productId, adminId)` from Task 2; `FEATURE_KEYS.PRODUCTS_VERIFY` from Task 3
- Produces: `verifyProductAction(productId: string, isVerified: boolean): Promise<{ success: true } | { error: string }>`

- [ ] **Step 1: Understand the permission check pattern**

Open `features/products/actions/products.ts` and look at lines 1–30. Find how `requireActionRole` and `canAdminManageProducts` are defined and imported. The `canVerifyProducts` checker you'll write must follow the exact same pattern but use `FEATURE_KEYS.PRODUCTS_VERIFY`.

- [ ] **Step 2: Write failing tests**

Create `tests/unit/verify-product-action.test.ts`. Model the mocks after any existing product action test in `tests/unit/` or `tests/api/`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/features/products/db/products", () => ({
  verifyProductInDb: vi.fn().mockResolvedValue(undefined),
  unverifyProductInDb: vi.fn().mockResolvedValue(undefined),
}))

const mockWhere = vi.fn().mockResolvedValue([{ moderationStatus: "approved", isVerified: false }])
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: mockWhere })) })),
  },
}))

// Match the exact mock path used in existing action tests
vi.mock("@/lib/action-guard", () => ({
  requireActionRole: vi.fn().mockResolvedValue({ user: { id: "admin-1" } }),
}))

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  mockWhere.mockResolvedValue([{ moderationStatus: "approved", isVerified: false }])
})

describe("verifyProductAction", () => {
  it("returns Unauthorized when user lacks products.verify permission", async () => {
    const { requireActionRole } = await import("@/lib/action-guard")
    vi.mocked(requireActionRole).mockResolvedValueOnce(null)
    const { verifyProductAction } = await import("@/features/products/actions/products")
    const result = await verifyProductAction("prod-1", true)
    expect(result).toEqual({ error: "Unauthorized" })
  })

  it("returns error when verifying a product with moderationStatus pending", async () => {
    mockWhere.mockResolvedValueOnce([{ moderationStatus: "pending", isVerified: false }])
    const { verifyProductAction } = await import("@/features/products/actions/products")
    const result = await verifyProductAction("prod-1", true)
    expect(result).toEqual({ error: "Product must be approved before verifying" })
  })

  it("returns error when product is not found", async () => {
    mockWhere.mockResolvedValueOnce([])
    const { verifyProductAction } = await import("@/features/products/actions/products")
    const result = await verifyProductAction("prod-1", true)
    expect(result).toEqual({ error: "Product not found" })
  })

  it("calls verifyProductInDb when approved and isVerified=true", async () => {
    const { verifyProductInDb } = await import("@/features/products/db/products")
    const { verifyProductAction } = await import("@/features/products/actions/products")
    const result = await verifyProductAction("prod-1", true)
    expect(verifyProductInDb).toHaveBeenCalledWith("prod-1", "admin-1")
    expect(result).toEqual({ success: true })
  })

  it("calls unverifyProductInDb when isVerified=false regardless of moderationStatus", async () => {
    const { unverifyProductInDb } = await import("@/features/products/db/products")
    const { verifyProductAction } = await import("@/features/products/actions/products")
    const result = await verifyProductAction("prod-1", false)
    expect(unverifyProductInDb).toHaveBeenCalledWith("prod-1", "admin-1")
    expect(result).toEqual({ success: true })
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npm run test:unit -- verify-product-action
```

Expected: FAIL — `verifyProductAction is not a function`

- [ ] **Step 4: Add canVerifyProducts checker**

In `features/products/actions/products.ts`, directly after the `canAdminManageProducts` definition (look at lines 1–30 for its exact form), add:

```typescript
const canVerifyProducts = (session: Session) =>
  hasPermission(session, FEATURE_KEYS.PRODUCTS_VERIFY)
```

Also add `FEATURE_KEYS` to the imports from `@/features/rbac/feature-keys` if not already imported.

- [ ] **Step 5: Add verifyProductAction**

```typescript
export async function verifyProductAction(
  productId: string,
  isVerified: boolean
): Promise<{ success: true } | { error: string }> {
  const session = await requireActionRole(canVerifyProducts)
  if (!session) return { error: "Unauthorized" }

  const [p] = await db
    .select({ moderationStatus: product.moderationStatus })
    .from(product)
    .where(eq(product.id, productId))

  if (!p) return { error: "Product not found" }

  if (isVerified && p.moderationStatus !== "approved") {
    return { error: "Product must be approved before verifying" }
  }

  if (isVerified) {
    await verifyProductInDb(productId, session.user.id)
  } else {
    await unverifyProductInDb(productId, session.user.id)
  }

  revalidateProductsCache()
  return { success: true }
}
```

Import `verifyProductInDb` and `unverifyProductInDb` from `@/features/products/db/products`.

- [ ] **Step 6: Add moderation auto-clear**

Find where single-product `moderationStatus` is updated in `features/products/actions/products.ts` or `features/products/db/products.ts` (look in `updateProductInDb` around line 1041). After the moderation status is written, add:

```typescript
// Auto-clear verified status when moderation changes away from approved
if (
  prevModerationStatus === "approved" &&
  newModerationStatus !== "approved" &&
  prevIsVerified
) {
  await unverifyProductInDb(productId, actorId)
}
```

(Fetch `prevModerationStatus` and `prevIsVerified` before the update if not already available.)

- [ ] **Step 7: Run tests to confirm they pass**

```bash
npm run test:unit -- verify-product-action
```

Expected: 5 passing

- [ ] **Step 8: Run full test suite**

```bash
npm run test
```

Expected: all passing

- [ ] **Step 9: Commit**

```bash
git add features/products/actions/products.ts tests/unit/verify-product-action.test.ts
git commit -m "feat: add verifyProductAction with RBAC guard and auto-clear on moderation change"
```

---

### Task 5: ProductForm — Verified Toggle UI

**Files:**
- Modify: `features/products/components/ProductForm.tsx`

**Interfaces:**
- Consumes: `verifyProductAction(productId, isVerified)` from Task 4; `product.isVerified: boolean`, `product.verifiedAt: Date | null` from `ProductForEdit` (Task 2); `FEATURE_KEYS.PRODUCTS_VERIFY` from Task 3

- [ ] **Step 1: Add verified state**

Find where `isFeatured`, `isCollectorPiece`, etc. are initialized with `useState` near the top of `ProductForm`. Add:

```typescript
const [isVerified, setIsVerified] = useState(product?.isVerified ?? false)
const [verifiedAt, setVerifiedAt] = useState<Date | null>(product?.verifiedAt ?? null)
```

- [ ] **Step 2: Derive canVerify from current user permissions**

Find where the form resolves current user permissions (look for how other RBAC-gated UI is done — e.g., admin-only fields). Add:

```typescript
const canVerify = hasPermission(currentUser, FEATURE_KEYS.PRODUCTS_VERIFY)
```

(`currentUser` or `session.user` — match what the form already uses for permission checks.)

- [ ] **Step 3: Import verifyProductAction**

At the top of `ProductForm.tsx`, add:

```typescript
import { verifyProductAction } from "@/features/products/actions/products"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
```

- [ ] **Step 4: Add verified toggle to the Visibility section**

Find the Visibility section around line 1482. After the Promotion toggle (lines 1564–1583), add:

```jsx
{canVerify && product?.id && (
  <>
    <label
      htmlFor="ft-verified"
      className={`pd-toggle${isVerified ? " on" : ""}${moderationStatus !== "approved" ? " disabled" : ""}`}
      title={moderationStatus !== "approved" ? "Set moderation to Approved first" : undefined}
    >
      <input
        id="ft-verified"
        type="checkbox"
        checked={isVerified}
        disabled={moderationStatus !== "approved"}
        onChange={async (e) => {
          const next = e.target.checked
          setIsVerified(next)
          const result = await verifyProductAction(product.id, next)
          if ("error" in result) {
            setIsVerified(!next)
            toast.error(result.error)
          } else {
            setVerifiedAt(next ? new Date() : null)
          }
        }}
        className="sr-only"
      />
      <span className="pd-toggle-chk"><Check size={10} /></span>
      <div className="pd-toggle-text">
        <span className="pd-toggle-label">GemX Verified</span>
        <span className="pd-toggle-sub">Physically authenticated by GemX staff</span>
      </div>
    </label>
    {isVerified && verifiedAt && (
      <p className="pd-hint" style={{ marginTop: 4 }}>
        Verified on {new Date(verifiedAt).toLocaleDateString()}
      </p>
    )}
  </>
)}
```

- [ ] **Step 5: Run full test suite**

```bash
npm run test
```

Expected: all passing

- [ ] **Step 6: Commit**

```bash
git add features/products/components/ProductForm.tsx
git commit -m "feat: add GemX Verified toggle to ProductForm Visibility section"
```

---

### Task 6: List View Pill + Mobile API + Homepage Badge

**Files:**
- Modify: `features/products/components/ProductsListView.tsx`
- Modify: `app/api/products/route.ts`
- Modify: `app/api/products/[id]/route.ts`
- Modify: `components/home/OwnProductsSection.tsx`

**Interfaces:**
- Consumes: `AdminProductRow.isVerified: boolean` from Task 2

- [ ] **Step 1: Add Verified pill to ProductFlags**

In `features/products/components/ProductsListView.tsx`, find `ProductFlags` (lines 71–80). Add the verified pill:

```jsx
function ProductFlags({ row }: { row: AdminProductRow }) {
  const flags = [
    row.isFeatured       && <span key="f" className="prod-flag featured">Featured</span>,
    row.isCollectorPiece && <span key="c" className="prod-flag collector">Collector</span>,
    row.isPrivilegeAssist && <span key="p" className="prod-flag privilege">Privilege</span>,
    row.isPromotion      && <span key="r" className="prod-flag promotion">Promo</span>,
    row.isVerified       && <span key="v" className="prod-flag verified">Verified</span>,
  ].filter(Boolean)
  if (!flags.length) return <span style={{ color: "var(--lv-text-4)", fontSize: 12 }}>—</span>
  return <span className="prod-flags">{flags}</span>
}
```

- [ ] **Step 2: Add CSS for the verified pill**

Find where `.prod-flag.featured`, `.prod-flag.collector`, etc. are styled (search the CSS files for `.prod-flag.featured`). Add alongside them:

```css
.prod-flag.verified {
  background: #ccfbf1;
  color: #0f766e;
}
```

- [ ] **Step 3: Add isVerified to public product list API response**

Open `app/api/products/route.ts`. Find `toPublicProductListItem` (lines 19–24):

```typescript
function toPublicProductListItem(p: AdminProductRow) {
  const { featuredExpiresAt, ...rest } = p
  return {
    ...rest,
    featured_expires_at: featuredExpiresAt?.toISOString() ?? null,
  }
}
```

`isVerified` is already included via `...rest`. Confirm by checking that `AdminProductRow` now has `isVerified` (Task 2). If the function explicitly whitelists fields instead of spreading, add `isVerified: p.isVerified` explicitly.

- [ ] **Step 4: Add isVerified to product detail API response**

Open `app/api/products/[id]/route.ts`. Find `maskCollectorPiece` (around line 27). Add `isVerified: false` to masked products (a masked collector piece should not show verified status):

```typescript
function maskCollectorPiece(p: { ... }) {
  return {
    // ... existing fields ...
    isVerified: false,  // ADD THIS
  }
}
```

For non-masked products, confirm `isVerified` is included in the response (it flows through from the DB query automatically if the query selection was updated in Task 2).

- [ ] **Step 5: Add GemX Verified badge to OwnProductsSection**

Open `components/home/OwnProductsSection.tsx`. Find the "Own Pick" badge (lines 105–109):

```jsx
<span style={{
  position: "absolute", top: 14, left: 14, fontSize: 11, fontWeight: 700,
  color: "#6d5ce7", background: "rgba(255,255,255,0.95)", padding: "4px 10px",
  borderRadius: 20, zIndex: 1,
}}>Own Pick</span>
```

Add the GemX Verified badge below it. Offset `top` by 30px when "Own Pick" is also showing so they stack cleanly:

```jsx
{p.isVerified && (
  <span style={{
    position: "absolute",
    top: p.isPrivilegeAssist ? 44 : 14,
    left: 14,
    fontSize: 11,
    fontWeight: 700,
    color: "#0f766e",
    background: "rgba(255,255,255,0.95)",
    padding: "4px 10px",
    borderRadius: 20,
    zIndex: 1,
  }}>
    GemX Verified
  </span>
)}
```

- [ ] **Step 6: Run full test suite**

```bash
npm run test
```

Expected: all passing

- [ ] **Step 7: Commit**

```bash
git add features/products/components/ProductsListView.tsx \
        app/api/products/route.ts \
        app/api/products/[id]/route.ts \
        components/home/OwnProductsSection.tsx
git commit -m "feat: show GemX Verified badge in list view, mobile API, and homepage cards"
```
