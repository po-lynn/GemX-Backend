# Admin Premium Dealer Activation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins create point purchase requests and activate Premium Dealer subscriptions on behalf of users from the admin panel, mirroring the existing mobile self-service flow.

**Architecture:** Two new server actions in `features/points/actions/points.ts` call existing DB functions. Two new dialog components are added to the points feature. The two admin pages (`purchase-requests` and `premium-dealer-subscriptions`) each get a trigger button that opens the relevant dialog. No schema changes required.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle ORM, Vitest, shadcn/ui Dialog, Tailwind CSS (lv-* utility classes)

---

## File Map

| Status | Path | Purpose |
|--------|------|---------|
| Modify | `features/points/db/points.ts` | Add `AdminCreatePurchaseRequestInput` type + `adminCreatePointPurchaseRequest()` |
| Modify | `features/points/actions/points.ts` | Add `adminCreatePointPurchaseRequestAction` + `adminActivatePremiumDealerAction` |
| Create | `features/points/components/AdminCreatePurchaseRequestDialog.tsx` | Dialog for creating a purchase request on behalf of a user |
| Create | `features/points/components/ActivatePremiumDealerDialog.tsx` | Dialog for activating premium dealer on behalf of a user |
| Modify | `app/admin/credit/purchase-requests/page.tsx` | Fetch users/packages/payment methods; add dialog button |
| Modify | `app/admin/credit/premium-dealer-subscriptions/page.tsx` | Fetch users/dealer packages; add dialog button |
| Create | `tests/unit/admin-create-purchase-request.test.ts` | Unit tests for DB function |
| Create | `tests/api/admin/admin-activate-premium-dealer.test.ts` | Action tests for both new actions |

---

## Task 1: DB function `adminCreatePointPurchaseRequest`

**Files:**
- Modify: `features/points/db/points.ts`
- Create: `tests/unit/admin-create-purchase-request.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/admin-create-purchase-request.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest"
import { adminCreatePointPurchaseRequest } from "@/features/points/db/points"
import { db } from "@/drizzle/db"

vi.mock("drizzle-orm", () => ({
  and: vi.fn(() => "and"),
  eq: vi.fn(() => "eq"),
  gte: vi.fn(() => "gte"),
  gt: vi.fn(() => "gt"),
  inArray: vi.fn(() => "inArray"),
  isNotNull: vi.fn(() => "isNotNull"),
  isNull: vi.fn(() => "isNull"),
  desc: vi.fn(() => "desc"),
  or: vi.fn(() => "or"),
  sql: vi.fn((x: unknown) => x),
  count: vi.fn(() => "count"),
  lte: vi.fn(() => "lte"),
  ilike: vi.fn(() => "ilike"),
}))

vi.mock("@/drizzle/schema/auth-schema", () => ({
  user: {
    id: "id", points: "points", role: "role",
    premiumDealerPackageName: "premium_dealer_package_name",
    premiumDealerExpiresAt: "premium_dealer_expires_at",
    email: "email", name: "name",
  },
}))

vi.mock("@/drizzle/schema/points-schema", () => ({
  pointSetting: { key: "key", valueText: "value_text" },
  pointPurchaseRequest: {
    id: "id", userId: "user_id", points: "points", status: "status",
    packageName: "package_name", price: "price", currency: "currency",
    paymentMethod: "payment_method", transferredAmount: "transferred_amount",
    transferredName: "transferred_name", transactionReference: "transaction_reference",
    transferNote: "transfer_note", createdAt: "created_at",
  },
  premiumDealersPackage: {
    id: "id", userId: "user_id", packageName: "package_name",
    startDate: "start_date", endDate: "end_date", autoRenew: "auto_renew", status: "status",
  },
  pointTransaction: {
    userId: "user_id", type: "type", direction: "direction", amount: "amount",
    status: "status", referenceId: "reference_id", referenceType: "reference_type",
    description: "description", paymentMethod: "payment_method", createdAt: "created_at",
  },
}))

vi.mock("@/drizzle/db", () => ({
  db: { insert: vi.fn() },
}))

describe("adminCreatePointPurchaseRequest", () => {
  const fakeRow = { id: "req-1", status: "pending", createdAt: new Date("2026-06-16") }

  beforeEach(() => { vi.clearAllMocks() })

  it("inserts a pending purchase request and returns it", async () => {
    // First db.insert = pointPurchaseRequest (needs .returning)
    // Second db.insert = pointTransaction via logPointTransaction (no .returning)
    const mockInsertPR = {
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([fakeRow]),
      }),
    }
    const mockInsertTx = { values: vi.fn().mockResolvedValue(undefined) }
    ;(db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockInsertPR)
      .mockReturnValueOnce(mockInsertTx)

    const result = await adminCreatePointPurchaseRequest({
      userId: "user-1",
      packageName: "Standard Package",
      points: 250,
      price: 25000,
      currency: "mmk",
      paymentMethod: "KBZ Pay",
    })

    expect(result).toEqual(fakeRow)
    expect(db.insert).toHaveBeenCalledTimes(2)
  })

  it("passes optional payment proof fields to the insert", async () => {
    const mockInsertPR = {
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([fakeRow]),
      }),
    }
    const mockInsertTx = { values: vi.fn().mockResolvedValue(undefined) }
    ;(db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockInsertPR)
      .mockReturnValueOnce(mockInsertTx)

    await adminCreatePointPurchaseRequest({
      userId: "user-1",
      packageName: "Basic Package",
      points: 100,
      price: 10000,
      currency: "mmk",
      paymentMethod: "AYA Pay",
      transferredAmount: 10000,
      transferredName: "Mg Mg",
      transactionReference: "TXN-123",
      transferNote: "For Standard Package",
    })

    expect(mockInsertPR.values).toHaveBeenCalledWith(
      expect.objectContaining({
        transferredAmount: 10000,
        transferredName: "Mg Mg",
        transactionReference: "TXN-123",
        transferNote: "For Standard Package",
      })
    )
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:unit -- admin-create-purchase-request
```

Expected: FAIL with "adminCreatePointPurchaseRequest is not a function" or similar.

- [ ] **Step 3: Add the type and function to `features/points/db/points.ts`**

After the existing `PremiumDealerPackage` type block (around line 42), add:

```typescript
export type AdminCreatePurchaseRequestInput = {
  userId: string
  packageName: string
  points: number
  price: number
  currency: "mmk" | "usd" | "krw"
  paymentMethod: string
  transferredAmount?: number | null
  transferredName?: string | null
  transactionReference?: string | null
  transferNote?: string | null
}
```

At the end of the file, add the function:

```typescript
export async function adminCreatePointPurchaseRequest(
  input: AdminCreatePurchaseRequestInput
): Promise<{ id: string; status: string; createdAt: Date }> {
  const [row] = await db
    .insert(pointPurchaseRequest)
    .values({
      userId: input.userId,
      packageName: input.packageName,
      points: input.points,
      price: input.price,
      currency: input.currency,
      paymentMethod: input.paymentMethod,
      status: "pending",
      transferredAmount: input.transferredAmount ?? null,
      transferredName: input.transferredName ?? null,
      transactionReference: input.transactionReference ?? null,
      transferNote: input.transferNote ?? null,
    })
    .returning({
      id: pointPurchaseRequest.id,
      status: pointPurchaseRequest.status,
      createdAt: pointPurchaseRequest.createdAt,
    })

  await logPointTransaction({
    userId: input.userId,
    type: "topup",
    direction: "credit",
    amount: input.points,
    status: "pending",
    referenceId: row.id,
    referenceType: "purchase_request",
    description: `Top-up via ${input.paymentMethod}`,
    paymentMethod: input.paymentMethod,
  })

  return row
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm run test:unit -- admin-create-purchase-request
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add features/points/db/points.ts tests/unit/admin-create-purchase-request.test.ts
git commit -m "feat: add adminCreatePointPurchaseRequest DB function"
```

---

## Task 2: Server actions for admin purchase request creation and premium dealer activation

**Files:**
- Modify: `features/points/actions/points.ts`
- Create: `tests/api/admin/admin-activate-premium-dealer.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/api/admin/admin-activate-premium-dealer.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  adminActivatePremiumDealerAction,
  adminCreatePointPurchaseRequestAction,
} from "@/features/points/actions/points"
import { requireActionRole } from "@/lib/action-guard"
import {
  getPremiumDealersSettings,
  activatePremiumDealer,
  adminCreatePointPurchaseRequest,
} from "@/features/points/db/points"

vi.mock("@/lib/action-guard", () => ({
  requireActionRole: vi.fn(),
}))

vi.mock("@/features/points/db/points", () => ({
  getPointManagementSettings: vi.fn(),
  savePremiumDealersSettings: vi.fn(),
  saveFeatureSettings: vi.fn(),
  savePointManagementSettings: vi.fn(),
  savePointPurchasePackagesSettings: vi.fn(),
  setDefaultRegistrationPoints: vi.fn(),
  setEarningPointsRates: vi.fn(),
  creditUserPoints: vi.fn(),
  deductUserPoints: vi.fn(),
  logPointTransaction: vi.fn(),
  approvePointPurchaseRequest: vi.fn(),
  rejectPointPurchaseRequest: vi.fn(),
  resetPointPurchaseRequestToPending: vi.fn(),
  overrideApprovePointPurchaseRequest: vi.fn(),
  overrideRejectPointPurchaseRequest: vi.fn(),
  deactivatePremiumDealerSubscription: vi.fn(),
  updatePremiumDealerSubscriptionExpiry: vi.fn(),
  getPremiumDealersSettings: vi.fn(),
  activatePremiumDealer: vi.fn(),
  adminCreatePointPurchaseRequest: vi.fn(),
}))

const mockSession = { user: { id: "admin-1", role: "admin" } }

describe("adminActivatePremiumDealerAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireActionRole as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
  })

  it("returns unauthorized when session is missing", async () => {
    ;(requireActionRole as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const fd = new FormData()
    fd.set("userId", "u1")
    fd.set("packageName", "Standard Package")
    fd.set("autoRenew", "false")
    expect(await adminActivatePremiumDealerAction(fd)).toEqual({ error: "Unauthorized" })
  })

  it("returns error when package not found in settings", async () => {
    ;(getPremiumDealersSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      packages: [{ name: "Basic Package", pointsRequired: 100, durationDays: 30 }],
    })
    const fd = new FormData()
    fd.set("userId", "u1")
    fd.set("packageName", "Nonexistent")
    fd.set("autoRenew", "false")
    expect(await adminActivatePremiumDealerAction(fd)).toEqual({
      error: "Package not found or disabled",
    })
  })

  it("returns error when activation returns null (insufficient points)", async () => {
    ;(getPremiumDealersSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      packages: [{ name: "Standard Package", pointsRequired: 250, durationDays: 30 }],
    })
    ;(activatePremiumDealer as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const fd = new FormData()
    fd.set("userId", "u1")
    fd.set("packageName", "Standard Package")
    fd.set("autoRenew", "false")
    expect(await adminActivatePremiumDealerAction(fd)).toEqual({
      error: "Insufficient points — approve a purchase request first",
    })
  })

  it("returns success with subscription details on successful activation", async () => {
    const now = new Date("2026-06-16")
    const expiry = new Date("2026-07-16")
    ;(getPremiumDealersSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      packages: [{ name: "Standard Package", pointsRequired: 250, durationDays: 30 }],
    })
    ;(activatePremiumDealer as ReturnType<typeof vi.fn>).mockResolvedValue({
      remainingPoints: 0,
      startDate: now,
      expiresAt: expiry,
      autoRenew: false,
      status: "active",
    })
    const fd = new FormData()
    fd.set("userId", "u1")
    fd.set("packageName", "Standard Package")
    fd.set("autoRenew", "false")
    expect(await adminActivatePremiumDealerAction(fd)).toEqual({
      success: true,
      remainingPoints: 0,
      startDate: now,
      expiresAt: expiry,
      autoRenew: false,
      status: "active",
    })
  })
})

describe("adminCreatePointPurchaseRequestAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireActionRole as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
  })

  it("returns unauthorized when session is missing", async () => {
    ;(requireActionRole as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const fd = new FormData()
    fd.set("userId", "u1")
    fd.set("packageName", "250 Points")
    fd.set("points", "250")
    fd.set("price", "25000")
    fd.set("currency", "mmk")
    fd.set("paymentMethod", "KBZ Pay")
    expect(await adminCreatePointPurchaseRequestAction(fd)).toEqual({ error: "Unauthorized" })
  })

  it("returns error when required fields are missing", async () => {
    const fd = new FormData()
    fd.set("userId", "u1")
    // missing packageName, points, etc.
    expect(await adminCreatePointPurchaseRequestAction(fd)).toEqual({
      error: "Missing required fields",
    })
  })

  it("creates a pending request and returns success with id", async () => {
    ;(adminCreatePointPurchaseRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "req-1",
      status: "pending",
      createdAt: new Date(),
    })
    const fd = new FormData()
    fd.set("userId", "u1")
    fd.set("packageName", "250 Points")
    fd.set("points", "250")
    fd.set("price", "25000")
    fd.set("currency", "mmk")
    fd.set("paymentMethod", "KBZ Pay")
    expect(await adminCreatePointPurchaseRequestAction(fd)).toEqual({
      success: true,
      id: "req-1",
    })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:api -- admin-activate-premium-dealer
```

Expected: FAIL — actions not yet exported.

- [ ] **Step 3: Update imports in `features/points/actions/points.ts`**

Add to the existing import block (lines 6–22):

```typescript
import {
  // ...existing imports unchanged...
  getPointManagementSettings,
  savePremiumDealersSettings,
  saveFeatureSettings,
  savePointManagementSettings,
  savePointPurchasePackagesSettings,
  setDefaultRegistrationPoints,
  setEarningPointsRates,
  creditUserPoints,
  deductUserPoints,
  logPointTransaction,
  approvePointPurchaseRequest,
  rejectPointPurchaseRequest,
  resetPointPurchaseRequestToPending,
  overrideApprovePointPurchaseRequest,
  overrideRejectPointPurchaseRequest,
  deactivatePremiumDealerSubscription,
  updatePremiumDealerSubscriptionExpiry,
  // NEW:
  getPremiumDealersSettings,
  activatePremiumDealer,
  adminCreatePointPurchaseRequest,
} from "@/features/points/db/points";
```

- [ ] **Step 4: Add the two new actions at the end of `features/points/actions/points.ts`**

```typescript
export async function adminCreatePointPurchaseRequestAction(formData: FormData) {
  const session = await requireActionRole(canAdminManageUsers);
  if (!session) return { error: "Unauthorized" };

  const userId = (formData.get("userId") as string) || "";
  const packageName = (formData.get("packageName") as string) || "";
  const paymentMethod = (formData.get("paymentMethod") as string) || "";
  const points = parseIntForm(formData.get("points"), 0);
  const price = parseIntForm(formData.get("price"), 0);
  const currency = (formData.get("currency") as string) || "mmk";
  const transferredAmount = formData.get("transferredAmount")
    ? parseIntForm(formData.get("transferredAmount"), 0)
    : null;
  const transferredName = (formData.get("transferredName") as string) || null;
  const transactionReference = (formData.get("transactionReference") as string) || null;
  const transferNote = (formData.get("transferNote") as string) || null;

  if (!userId || !packageName || !paymentMethod || points <= 0 || price <= 0) {
    return { error: "Missing required fields" };
  }
  if (!["mmk", "usd", "krw"].includes(currency)) {
    return { error: "Invalid currency" };
  }

  const row = await adminCreatePointPurchaseRequest({
    userId,
    packageName,
    points,
    price,
    currency: currency as "mmk" | "usd" | "krw",
    paymentMethod,
    transferredAmount,
    transferredName,
    transactionReference,
    transferNote,
  });
  return { success: true, id: row.id };
}

export async function adminActivatePremiumDealerAction(formData: FormData) {
  const session = await requireActionRole(canAdminManageUsers);
  if (!session) return { error: "Unauthorized" };

  const userId = (formData.get("userId") as string) || "";
  const packageName = (formData.get("packageName") as string) || "";
  const autoRenew = formData.get("autoRenew") === "true";

  if (!userId || !packageName) return { error: "Missing required fields" };

  const settings = await getPremiumDealersSettings();
  const pkg = settings.packages.find((p) => p.name === packageName && p.enabled !== false);
  if (!pkg) return { error: "Package not found or disabled" };

  const result = await activatePremiumDealer(userId, pkg, autoRenew);
  if (!result) return { error: "Insufficient points — approve a purchase request first" };

  return { success: true, ...result };
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm run test:api -- admin-activate-premium-dealer
```

Expected: PASS (7 tests).

- [ ] **Step 6: Run full test suite to catch regressions**

```bash
npm run test
```

Expected: all previously passing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add features/points/actions/points.ts features/points/db/points.ts tests/api/admin/admin-activate-premium-dealer.test.ts
git commit -m "feat: add admin actions for purchase request creation and premium dealer activation"
```

---

## Task 3: `AdminCreatePurchaseRequestDialog` component

**Files:**
- Create: `features/points/components/AdminCreatePurchaseRequestDialog.tsx`

- [ ] **Step 1: Create the component**

Create `features/points/components/AdminCreatePurchaseRequestDialog.tsx`:

```tsx
"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { adminCreatePointPurchaseRequestAction } from "@/features/points/actions/points"
import type { PointPurchasePackage, PaymentMethod } from "@/features/points/db/points"

type UserOption = {
  id: string
  name: string | null
  email: string
  phone: string | null
  points: number
}

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  padding: "9px 12px",
  border: "1px solid var(--lv-border)",
  borderRadius: 8,
  outline: "none",
  width: "100%",
  background: "#fff",
  color: "var(--lv-text)",
}

function getInitials(name: string | null): string {
  if (!name) return "?"
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
}

function getHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff
  return h % 360
}

export function AdminCreatePurchaseRequestDialog({
  users,
  pointPackages,
  paymentMethods,
}: {
  users: UserOption[]
  pointPackages: PointPurchasePackage[]
  paymentMethods: PaymentMethod[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const [query, setQuery] = useState("")
  const [showList, setShowList] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null)
  const [packageName, setPackageName] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [transferredAmount, setTransferredAmount] = useState("")
  const [transferredName, setTransferredName] = useState("")
  const [transactionReference, setTransactionReference] = useState("")
  const [transferNote, setTransferNote] = useState("")

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return users.slice(0, 8)
    return users
      .filter(
        (u) =>
          (u.name ?? "").toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone ?? "").includes(q)
      )
      .slice(0, 8)
  }, [query, users])

  const selectedPackage = pointPackages.find((p) => p.name === packageName)

  function reset() {
    setQuery("")
    setSelectedUser(null)
    setPackageName("")
    setPaymentMethod("")
    setTransferredAmount("")
    setTransferredName("")
    setTransactionReference("")
    setTransferNote("")
    setError(null)
    setShowList(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUser || !packageName || !paymentMethod || !selectedPackage) {
      setError("Please fill in all required fields.")
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set("userId", selectedUser.id)
      fd.set("packageName", packageName)
      fd.set("points", String(selectedPackage.points + (selectedPackage.bonus ?? 0)))
      fd.set("price", String(selectedPackage.priceMmk ?? 0))
      fd.set("currency", "mmk")
      fd.set("paymentMethod", paymentMethod)
      if (transferredAmount) fd.set("transferredAmount", transferredAmount)
      if (transferredName) fd.set("transferredName", transferredName)
      if (transactionReference) fd.set("transactionReference", transactionReference)
      if (transferNote) fd.set("transferNote", transferNote)

      const result = await adminCreatePointPurchaseRequestAction(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        setOpen(false)
        reset()
        startTransition(() => router.refresh())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button size="sm" className="shrink-0 shadow-sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 size-4" />
        Create Request
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!submitting && !v) {
            setOpen(false)
            reset()
          }
        }}
      >
        <DialogContent style={{ maxWidth: 480 }}>
          <DialogHeader>
            <DialogTitle className="text-base">Create Payment Transaction</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            {/* User search */}
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--lv-text-2)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                User *
              </label>
              <div style={{ position: "relative" }}>
                <Search
                  style={{
                    position: "absolute",
                    left: 11,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 14,
                    height: 14,
                    color: "var(--lv-text-3)",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search by name, email or phone…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setShowList(true)
                    setSelectedUser(null)
                  }}
                  onFocus={() => setShowList(true)}
                  onBlur={() => setTimeout(() => setShowList(false), 150)}
                  style={{ ...inputStyle, paddingLeft: 34 }}
                  autoComplete="off"
                />
                {showList && filtered.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      background: "#fff",
                      border: "1px solid var(--lv-border)",
                      borderRadius: 10,
                      boxShadow: "var(--lv-shadow-pop)",
                      overflow: "hidden",
                    }}
                  >
                    {filtered.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onMouseDown={() => {
                          setSelectedUser(u)
                          setQuery(u.name ?? u.email)
                          setShowList(false)
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span
                          className="lv-avatar"
                          data-hue={getHue(u.id)}
                          style={{ width: 30, height: 30, fontSize: 11, flexShrink: 0 }}
                        >
                          {getInitials(u.name)}
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{ fontSize: 13, fontWeight: 600, color: "var(--lv-text)" }}
                          >
                            {u.name}
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--lv-text-3)" }}>
                            {u.email}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--lv-text-2)",
                            fontWeight: 600,
                          }}
                        >
                          {u.points.toLocaleString()} pts
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Package select */}
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--lv-text-2)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Point Package *
              </label>
              <select
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                style={inputStyle}
                required
              >
                <option value="">Select a package…</option>
                {pointPackages
                  .filter((p) => p.enabled !== false)
                  .map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} — {p.points}
                      {p.bonus ? ` +${p.bonus}` : ""} pts
                      {p.priceMmk ? ` (${p.priceMmk.toLocaleString()} MMK)` : ""}
                    </option>
                  ))}
              </select>
            </div>

            {/* Payment method */}
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--lv-text-2)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={inputStyle}
                required
              >
                <option value="">Select a method…</option>
                {paymentMethods
                  .filter((m) => m.enabled !== false)
                  .map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Transfer details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--lv-text-2)",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Transferred Amount
                </label>
                <input
                  type="number"
                  value={transferredAmount}
                  onChange={(e) => setTransferredAmount(e.target.value)}
                  placeholder="e.g. 25000"
                  style={inputStyle}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--lv-text-2)",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Transfer Name
                </label>
                <input
                  type="text"
                  value={transferredName}
                  onChange={(e) => setTransferredName(e.target.value)}
                  placeholder="Name on transfer"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--lv-text-2)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Transaction Reference
              </label>
              <input
                type="text"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                placeholder="Receipt or reference number"
                style={inputStyle}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--lv-text-2)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Note
              </label>
              <textarea
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="Optional note"
                style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
              />
            </div>

            {error && (
              <p
                style={{
                  fontSize: 13,
                  color: "#dc2626",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: "8px 12px",
                  margin: 0,
                }}
              >
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(false)
                  reset()
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || !selectedUser || !packageName || !paymentMethod}
              >
                {submitting ? "Creating…" : "Create Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add features/points/components/AdminCreatePurchaseRequestDialog.tsx
git commit -m "feat: add AdminCreatePurchaseRequestDialog component"
```

---

## Task 4: Wire `AdminCreatePurchaseRequestDialog` into the purchase-requests page

**Files:**
- Modify: `app/admin/credit/purchase-requests/page.tsx`

- [ ] **Step 1: Add imports to the page**

Add at the top of `app/admin/credit/purchase-requests/page.tsx` (after existing imports):

```typescript
import { getAllUsersFromDb } from "@/features/users/db/users"
import {
  getPointPurchasePackagesSettings,
  getPointManagementSettings,
} from "@/features/points/db/points"
import { AdminCreatePurchaseRequestDialog } from "@/features/points/components/AdminCreatePurchaseRequestDialog"
```

- [ ] **Step 2: Fetch data in the page component**

In the `AdminPointPurchaseRequestsPage` function body, after the `await requireFeatureAccess(...)` line, add:

```typescript
const [users, packagesSettings, managementSettings] = await Promise.all([
  getAllUsersFromDb(),
  getPointPurchasePackagesSettings(),
  getPointManagementSettings(),
])
```

- [ ] **Step 3: Add the dialog button to `lv-pagehead-actions`**

Replace the existing `lv-pagehead-actions` div (around line 65):

```tsx
<div className="lv-pagehead-actions">
  <AdminCreatePurchaseRequestDialog
    users={users}
    pointPackages={packagesSettings.packages}
    paymentMethods={managementSettings.paymentMethods}
  />
  <PressButton className="lv-export-btn">
    <Download /> Export Excel
  </PressButton>
</div>
```

- [ ] **Step 4: Run lint and type check**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/admin/credit/purchase-requests/page.tsx
git commit -m "feat: add Create Request button to payment transactions admin page"
```

---

## Task 5: `ActivatePremiumDealerDialog` component

**Files:**
- Create: `features/points/components/ActivatePremiumDealerDialog.tsx`

- [ ] **Step 1: Create the component**

Create `features/points/components/ActivatePremiumDealerDialog.tsx`:

```tsx
"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { adminActivatePremiumDealerAction } from "@/features/points/actions/points"
import type { PremiumDealerPackage } from "@/features/points/db/points"

type UserOption = {
  id: string
  name: string | null
  email: string
  phone: string | null
  points: number
}

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  padding: "9px 12px",
  border: "1px solid var(--lv-border)",
  borderRadius: 8,
  outline: "none",
  width: "100%",
  background: "#fff",
  color: "var(--lv-text)",
}

function getInitials(name: string | null): string {
  if (!name) return "?"
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
}

function getHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff
  return h % 360
}

export function ActivatePremiumDealerDialog({
  users,
  packages,
}: {
  users: UserOption[]
  packages: PremiumDealerPackage[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const [query, setQuery] = useState("")
  const [showList, setShowList] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null)
  const [packageName, setPackageName] = useState("")
  const [autoRenew, setAutoRenew] = useState(false)

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return users.slice(0, 8)
    return users
      .filter(
        (u) =>
          (u.name ?? "").toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone ?? "").includes(q)
      )
      .slice(0, 8)
  }, [query, users])

  const selectedPkg = packages.find((p) => p.name === packageName)
  const hasEnoughPoints =
    selectedUser && selectedPkg ? selectedUser.points >= selectedPkg.pointsRequired : true

  function reset() {
    setQuery("")
    setSelectedUser(null)
    setPackageName("")
    setAutoRenew(false)
    setError(null)
    setShowList(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUser || !packageName) {
      setError("Please fill in all required fields.")
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set("userId", selectedUser.id)
      fd.set("packageName", packageName)
      fd.set("autoRenew", String(autoRenew))
      const result = await adminActivatePremiumDealerAction(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        setOpen(false)
        reset()
        startTransition(() => router.refresh())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button size="sm" className="shrink-0 shadow-sm" onClick={() => setOpen(true)}>
        <Sparkles className="mr-1.5 size-4" />
        Activate Premium Dealer
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!submitting && !v) {
            setOpen(false)
            reset()
          }
        }}
      >
        <DialogContent style={{ maxWidth: 440 }}>
          <DialogHeader>
            <DialogTitle className="text-base">Activate Premium Dealer</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            {/* User search */}
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--lv-text-2)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                User *
              </label>
              <div style={{ position: "relative" }}>
                <Search
                  style={{
                    position: "absolute",
                    left: 11,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 14,
                    height: 14,
                    color: "var(--lv-text-3)",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search by name, email or phone…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setShowList(true)
                    setSelectedUser(null)
                  }}
                  onFocus={() => setShowList(true)}
                  onBlur={() => setTimeout(() => setShowList(false), 150)}
                  style={{ ...inputStyle, paddingLeft: 34 }}
                  autoComplete="off"
                />
                {showList && filtered.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      background: "#fff",
                      border: "1px solid var(--lv-border)",
                      borderRadius: 10,
                      boxShadow: "var(--lv-shadow-pop)",
                      overflow: "hidden",
                    }}
                  >
                    {filtered.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onMouseDown={() => {
                          setSelectedUser(u)
                          setQuery(u.name ?? u.email)
                          setShowList(false)
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span
                          className="lv-avatar"
                          data-hue={getHue(u.id)}
                          style={{ width: 30, height: 30, fontSize: 11, flexShrink: 0 }}
                        >
                          {getInitials(u.name)}
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "var(--lv-text)",
                            }}
                          >
                            {u.name}
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--lv-text-3)" }}>
                            {u.email}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--lv-text-2)",
                            fontWeight: 600,
                          }}
                        >
                          {u.points.toLocaleString()} pts
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Package select */}
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--lv-text-2)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Premium Package *
              </label>
              <select
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                style={inputStyle}
                required
              >
                <option value="">Select a package…</option>
                {packages
                  .filter((p) => p.enabled !== false)
                  .map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} — {p.pointsRequired} pts · {p.durationDays} days
                    </option>
                  ))}
              </select>
            </div>

            {/* Points balance check */}
            {selectedUser && selectedPkg && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: hasEnoughPoints ? "var(--lv-panel-2)" : "#fef2f2",
                  border: `1px solid ${hasEnoughPoints ? "var(--lv-border)" : "#fecaca"}`,
                  fontSize: 13,
                }}
              >
                <span style={{ color: "var(--lv-text-2)" }}>
                  {selectedUser.name} has{" "}
                  <strong
                    style={{ color: hasEnoughPoints ? "var(--lv-text)" : "#dc2626" }}
                  >
                    {selectedUser.points.toLocaleString()} pts
                  </strong>{" "}
                  · package requires{" "}
                  <strong>{selectedPkg.pointsRequired.toLocaleString()} pts</strong>
                </span>
                {!hasEnoughPoints && (
                  <div style={{ marginTop: 4, color: "#dc2626", fontSize: 12 }}>
                    Approve a payment transaction first to top up this user.
                  </div>
                )}
              </div>
            )}

            {/* Auto-renew */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontSize: 13,
                color: "var(--lv-text)",
              }}
            >
              <input
                type="checkbox"
                checked={autoRenew}
                onChange={(e) => setAutoRenew(e.target.checked)}
              />
              Auto-renew when subscription expires
            </label>

            {error && (
              <p
                style={{
                  fontSize: 13,
                  color: "#dc2626",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: "8px 12px",
                  margin: 0,
                }}
              >
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(false)
                  reset()
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  submitting || !selectedUser || !packageName || !hasEnoughPoints
                }
              >
                {submitting ? "Activating…" : "Activate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add features/points/components/ActivatePremiumDealerDialog.tsx
git commit -m "feat: add ActivatePremiumDealerDialog component"
```

---

## Task 6: Wire `ActivatePremiumDealerDialog` into the subscriptions page

**Files:**
- Modify: `app/admin/credit/premium-dealer-subscriptions/page.tsx`

- [ ] **Step 1: Add imports**

Add at the top of `app/admin/credit/premium-dealer-subscriptions/page.tsx` (after existing imports):

```typescript
import { getAllUsersFromDb } from "@/features/users/db/users"
import { getPremiumDealersSettings } from "@/features/points/db/points"
import { ActivatePremiumDealerDialog } from "@/features/points/components/ActivatePremiumDealerDialog"
```

- [ ] **Step 2: Fetch users in the page component**

In the page function body, after `await requireFeatureAccess(...)`, add a parallel fetch:

```typescript
const [users, current, counts, dealerSettings] = await Promise.all([
  getAllUsersFromDb(),
  getPremiumDealerSubscriptionsPaginated({
    page,
    limit: PAGE_SIZE,
    status: status === "all" ? undefined : status,
  }),
  getPremiumDealerSubscriptionCounts(),
  getPremiumDealersSettings(),
])
```

Remove the existing sequential calls to `getPremiumDealerSubscriptionsPaginated` and `getPremiumDealerSubscriptionCounts` that were previously separate.

- [ ] **Step 3: Add the dialog button to `lv-pagehead-actions`**

Replace the existing `lv-pagehead-actions` div (the one with the Export button):

```tsx
<div className="lv-pagehead-actions">
  <ActivatePremiumDealerDialog
    users={users}
    packages={dealerSettings.packages}
  />
  <PressButton className="lv-export-btn">
    <Download /> Export Excel
  </PressButton>
</div>
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Run full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/admin/credit/premium-dealer-subscriptions/page.tsx
git commit -m "feat: add Activate Premium Dealer button to subscriptions admin page"
```

---

## End-to-End Verification

After all tasks are complete, verify the full admin workflow manually:

1. Go to `/admin/users/new` → create a test user (role: user, 0 points)
2. Go to `/admin/credit/purchase-requests` → click **Create Request**
   - Search for the new user
   - Select a point package (e.g., "Standard Package — 250 pts")
   - Select a payment method (e.g., "KBZ Pay")
   - Enter a fake transfer reference
   - Submit → request appears in the Pending tab
3. In the Pending tab, approve the new request → user now has 250 points
4. Go to `/admin/credit/premium-dealer-subscriptions` → click **Activate Premium Dealer**
   - Search for the same user (should show 250 pts balance)
   - Select "Standard Package" (requires 250 pts) — balance banner should show green
   - Submit → subscription appears in the Active tab
5. Log in as that user → should be redirected to `/portal` (role = portal)
6. Verify the user's role in `/admin/users` shows "portal"
7. Verify the point transaction ledger shows a "topup" (pending→completed) and a "premium_activation" debit
