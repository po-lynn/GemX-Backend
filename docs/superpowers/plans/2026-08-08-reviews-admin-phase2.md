# Reviews & Seller Reputation admin area — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the five remaining `ComingSoonView` placeholders (`/admin/reviews`, `/admin/reviews/sellers`, `/admin/reviews/archived`, `/admin/reviews/thresholds`, `/admin/reviews/audit`) with working views, adding a Restore mutation and an admin-gated Threshold-toggle mutation along the way.

**Architecture:** Five independent read-mostly views on top of phase 1's three existing tables — no new tables. Three of the five (Seller ratings, Archived sellers, Audit log) are `ListViewCard` tables; Overview is a KPI-tile dashboard; Thresholds is a toggle list. Every new DB function is a single aggregate/join query, sequential and `withQueryTimeout`-wrapped, never calling `computeCaseSummaries()` (that stays scoped to Reputation Cases).

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (postgres-js), Zod, Vitest, `sonner` toasts, the existing `components/admin/list-view/ListViewCard`.

**Design spec:** `docs/superpowers/specs/2026-08-08-reviews-admin-phase2-design.md` — read it for the full rationale (why admin-only for toggling, why no seller drill-down, what's explicitly out of scope). This plan implements that spec; do not re-litigate decisions already made there.

## Global Constraints

- **Never run `npm run db:generate`, `npm run db:migrate`, or `npm run db:push`.** No schema changes in this plan (no new tables, no column changes) — this constraint is restated because it is a standing rule for this codebase, not because any task here needs it.
- **Never use `Promise.all()` for concurrent DB queries in a server component or route handler.** Run DB calls sequentially, each wrapped in `withQueryTimeout(promise, ms, label)` from `lib/query-timeout.ts` (6000ms default), exactly as `features/reviews/db/reputation-cases.ts` already does.
- **Zod schemas live in `features/reviews/schemas/reputation-actions.ts`** (the existing file from phase 1) — add to it, do not create a second schemas file for this feature.
- **New mutation actions live in `features/reviews/actions/reputation-cases.ts`** (the existing file from phase 1) — it already holds the local `requireReviewsSession()` and `mutationErrorMessage()` helpers every mutation needs; a second actions file would either duplicate them or need to import unexported internals. Add to it.
- **Every mutation requires a reason string** (`.min(1)` in its Zod schema): Restore and Threshold-toggle both need one, matching Archive/Dismiss's existing convention.
- **Threshold-toggle requires `role === "admin"` specifically** — not the standard `requireReviewsSession()` bar (which also allows internal staff holding `FEATURE_KEYS.REVIEWS`). Viewing the Thresholds page stays at the standard bar; only the toggle mutation is admin-only. See the design spec's Thresholds section for why.
- **`toggleThreshold` rejects enabling a rule with `dataAvailable: false`** server-side (currently only `non_delivery_reports`), not just via a disabled UI control — defense in depth against a direct action call.
- **`restoreSeller`'s UPDATE is guarded by `WHERE seller_user_id = ? AND restored_at IS NULL`**, not a blind update — a concurrent double-restore then affects 0 rows instead of double-writing `restoredByAdminId`.
- **`archiveSeller`'s upsert must also null out `restoredByAdminId`** on conflict (it currently only nulls `restoredAt`) — a restore-then-rearchive would otherwise leave a contradictory row (`restoredAt IS NULL` with a non-null `restoredByAdminId`). Fix this as part of Task 1, not a follow-up.
- **Sequential number bind params (`${opts.limit}`, `${offset}`, `Date` objects) are fine in raw `sql` templates** — the `= ANY(${array})` binding bug phase 1 hit only applies to embedding a plain JS **array**; scalars bind correctly. Where an array of ids or enum values needs binding, use `sql.join(items.map((i) => sql\`${i}\`), sql\`, \`)` wrapped in `IN (...)`, exactly as `features/reviews/db/reputation-cases.ts`'s `hydrateCases` already does — never `= ANY(${array})`.
- Node 22 must be active for every npm/git-hook-triggering command: `source ~/.nvm/nvm.sh && nvm use 22` in the same shell invocation (does not persist across separate tool calls).
- After every task that touches `features/` or `app/`, run `npm run lint` and the relevant `npm run test:*` script before committing — the pre-commit hook runs lint and will block the commit otherwise.
- Per this repo's CLAUDE.md, every change requires a technical doc, tests, and a collaborator guide. Task 13 covers all of it in one consolidated pass, exactly as phase 1's Task 12 did — do not write per-task docs.
- **Never `git commit --amend` or `git reset` on any commit already on the branch, under any circumstances.** Phase 1's branch suffered three incidents of implementers doing this to recover from a failed command (usually `npm: not found`). If a command fails, the fix is `source ~/.nvm/nvm.sh && nvm use 22`, never git surgery.

---

### Task 1: Archived sellers DB layer (list + restore) + archiveSeller upsert fix

**Preconditions:** None — phase 1's tables and `writeReputationAction`/`archiveSeller` already exist.

**Files:**
- Create: `features/reviews/db/reputation-archive.ts`
- Modify: `features/reviews/db/reputation-actions.ts` (the `archiveSeller` upsert fix)
- Test: `tests/unit/reputation-archive.test.ts`
- Test: `tests/unit/reputation-actions.test.ts` (extend — one new assertion)

**Interfaces:**
- Produces: `type ArchivedSeller`, `getArchivedSellers(opts: { page: number; limit: number }): Promise<{ sellers: ArchivedSeller[]; total: number }>`, `restoreSeller(input: { sellerUserId: string; reason: string; adminUserId: string }): Promise<void>`
- Consumed by: Task 2 (`restoreSellerAction`), Task 3 (`ArchivedSellersTable`/page)

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/reputation-archive.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const captured = vi.hoisted(() => ({ queries: [] as string[], joinChunks: [] as unknown[][] }))

vi.mock("drizzle-orm", () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      captured.queries.push([...strings].join(""))
      return { strings, values }
    },
    {
      raw: (s: string) => s,
      join: (chunks: unknown[], separator?: unknown) => {
        captured.joinChunks.push(chunks)
        return { chunks, separator }
      },
    }
  ),
  eq: vi.fn(() => "eq"),
  and: vi.fn(() => "and"),
}))

vi.mock("@/drizzle/schema/reputation-schema", () => ({
  sellerArchive: {
    id: "id", sellerUserId: "seller_user_id", reason: "reason",
    archivedByAdminId: "archived_by_admin_id", archivedAt: "archived_at",
    appealStatus: "appeal_status", restoredAt: "restored_at", restoredByAdminId: "restored_by_admin_id",
  },
}))
vi.mock("@/drizzle/db", () => ({
  db: { select: vi.fn(), execute: vi.fn(), update: vi.fn() },
}))
vi.mock("@/lib/query-timeout", () => ({
  withQueryTimeout: vi.fn((p: Promise<unknown>) => p),
}))
vi.mock("@/features/reviews/db/reputation-actions", () => ({
  writeReputationAction: vi.fn().mockResolvedValue(undefined),
}))

import { db } from "@/drizzle/db"
import { writeReputationAction } from "@/features/reviews/db/reputation-actions"
import { getArchivedSellers, restoreSeller } from "@/features/reviews/db/reputation-archive"

beforeEach(() => {
  vi.clearAllMocks()
  captured.queries = []
  captured.joinChunks = []
})

describe("getArchivedSellers", () => {
  it("returns hydrated sellers with admin names resolved from a follow-up lookup", async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 1 }]) }),
    } as never)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([
                {
                  sellerUserId: "seller-1",
                  reason: "Below 3.8 for 6 days",
                  archivedByAdminId: "admin-1",
                  archivedAt: new Date("2026-08-01"),
                  appealStatus: "none",
                },
              ]),
            }),
          }),
        }),
      }),
    } as never)
    vi.mocked(db.execute).mockResolvedValue([
      { id: "seller-1", name: "Pyin Oo Lwin Stones", image: null },
      { id: "admin-1", name: "Admin One", image: null },
    ] as never)

    const result = await getArchivedSellers({ page: 1, limit: 20 })

    expect(result.total).toBe(1)
    expect(result.sellers[0]).toEqual({
      sellerUserId: "seller-1",
      sellerName: "Pyin Oo Lwin Stones",
      sellerImage: null,
      reason: "Below 3.8 for 6 days",
      archivedByAdminId: "admin-1",
      archivedByAdminName: "Admin One",
      archivedAt: new Date("2026-08-01"),
      appealStatus: "none",
    })
  })

  it("falls back to null admin name when the admin id itself is null (deleted admin)", async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 1 }]) }),
    } as never)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([
                {
                  sellerUserId: "seller-1",
                  reason: "x",
                  archivedByAdminId: null,
                  archivedAt: new Date("2026-08-01"),
                  appealStatus: "none",
                },
              ]),
            }),
          }),
        }),
      }),
    } as never)
    vi.mocked(db.execute).mockResolvedValue([
      { id: "seller-1", name: "Seller", image: null },
    ] as never)

    const result = await getArchivedSellers({ page: 1, limit: 20 })

    expect(result.sellers[0].archivedByAdminId).toBeNull()
    expect(result.sellers[0].archivedByAdminName).toBeNull()
  })

  it("returns an empty list without a user lookup when there are no archived sellers", async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 0 }]) }),
    } as never)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({ offset: vi.fn().mockResolvedValue([]) }),
          }),
        }),
      }),
    } as never)

    const result = await getArchivedSellers({ page: 1, limit: 20 })

    expect(result).toEqual({ sellers: [], total: 0 })
    expect(db.execute).not.toHaveBeenCalled()
  })
})

describe("restoreSeller", () => {
  it("updates the row, writes a restored audit action", async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: "row-1" }])
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
    const setMock = vi.fn().mockReturnValue({ where: whereMock })
    vi.mocked(db.update).mockReturnValue({ set: setMock } as never)

    await restoreSeller({ sellerUserId: "seller-1", reason: "Appeal upheld", adminUserId: "admin-1" })

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ restoredByAdminId: "admin-1" })
    )
    expect(writeReputationAction).toHaveBeenCalledWith({
      sellerUserId: "seller-1",
      actionType: "restored",
      reason: "Appeal upheld",
      adminUserId: "admin-1",
    })
  })

  it("throws without writing an audit action when the seller isn't currently archived", async () => {
    const returningMock = vi.fn().mockResolvedValue([])
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
    const setMock = vi.fn().mockReturnValue({ where: whereMock })
    vi.mocked(db.update).mockReturnValue({ set: setMock } as never)

    await expect(
      restoreSeller({ sellerUserId: "seller-1", reason: "x", adminUserId: "admin-1" })
    ).rejects.toThrow("Seller is not currently archived")
    expect(writeReputationAction).not.toHaveBeenCalled()
  })
})
```

```ts
// tests/unit/reputation-actions.test.ts — add this assertion inside the existing
// "writes a seller_archive row and an 'archived' action row" test (Task 5,
// phase 1), replacing the current onConflictDoUpdate expectation:
expect(onConflictDoUpdateMock).toHaveBeenCalledWith({
  target: "seller_user_id",
  set: expect.objectContaining({
    reason: "Below 3.8 for 6 days",
    archivedByAdminId: "admin-1",
    restoredAt: null,
    restoredByAdminId: null,
  }),
})
```

(Read the existing test file first — it mocks `onConflictDoUpdate` inline per-test; add `restoredByAdminId: null` to whichever assertion currently checks the `set` object, in both the "writes a seller_archive row" test and the pre-existing upsert-conflict test from phase 1's fix wave.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:unit -- reputation-archive`
Expected: FAIL — module `@/features/reviews/db/reputation-archive` does not exist.

- [ ] **Step 3: Implement**

```ts
// features/reviews/db/reputation-archive.ts
import { and, eq, sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { sellerArchive } from "@/drizzle/schema/reputation-schema"
import { withQueryTimeout } from "@/lib/query-timeout"
import { writeReputationAction } from "./reputation-actions"

const QUERY_TIMEOUT_MS = 6000

export type ArchivedSeller = {
  sellerUserId: string
  sellerName: string
  sellerImage: string | null
  reason: string
  archivedByAdminId: string | null
  archivedByAdminName: string | null
  archivedAt: Date
  appealStatus: "none" | "under_review" | "rejected" | "upheld_restored"
}

/** Lists currently-archived sellers (restoredAt IS NULL), newest first. */
export async function getArchivedSellers(opts: {
  page: number
  limit: number
}): Promise<{ sellers: ArchivedSeller[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit

  const totalResult = await withQueryTimeout(
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sellerArchive)
      .where(sql`${sellerArchive.restoredAt} IS NULL`),
    QUERY_TIMEOUT_MS,
    "archived-sellers-count"
  )
  const total = totalResult[0]?.count ?? 0

  const rows = await withQueryTimeout(
    db
      .select({
        sellerUserId: sellerArchive.sellerUserId,
        reason: sellerArchive.reason,
        archivedByAdminId: sellerArchive.archivedByAdminId,
        archivedAt: sellerArchive.archivedAt,
        appealStatus: sellerArchive.appealStatus,
      })
      .from(sellerArchive)
      .where(sql`${sellerArchive.restoredAt} IS NULL`)
      .orderBy(sql`${sellerArchive.archivedAt} DESC`)
      .limit(opts.limit)
      .offset(offset),
    QUERY_TIMEOUT_MS,
    "archived-sellers-list"
  )

  if (rows.length === 0) return { sellers: [], total }

  // One lookup query for both sellers and archiving admins — both reference
  // user.id, so a single IN-list covers both roles. sql.join, never
  // `= ANY(${array})` — see Global Constraints.
  const userIds = [
    ...new Set(
      rows.flatMap((r) => [r.sellerUserId, r.archivedByAdminId]).filter((id): id is string => !!id)
    ),
  ]
  const userIdList = sql.join(userIds.map((id) => sql`${id}`), sql`, `)
  const userResult = await withQueryTimeout(
    db.execute(sql`SELECT id, name, image FROM "user" WHERE id IN (${userIdList})`),
    QUERY_TIMEOUT_MS,
    "archived-sellers-users"
  )
  const userById = new Map(
    ([...userResult] as Array<{ id: string; name: string; image: string | null }>).map((u) => [u.id, u])
  )

  return {
    total,
    sellers: rows.map((r) => {
      const seller = userById.get(r.sellerUserId)
      return {
        sellerUserId: r.sellerUserId,
        sellerName: seller?.name ?? "Unknown seller",
        sellerImage: seller?.image ?? null,
        reason: r.reason,
        archivedByAdminId: r.archivedByAdminId,
        archivedByAdminName: r.archivedByAdminId ? userById.get(r.archivedByAdminId)?.name ?? null : null,
        archivedAt: r.archivedAt,
        appealStatus: r.appealStatus,
      }
    }),
  }
}

/**
 * Restores a seller — the inverse of archiveSeller. Guarded by
 * `restoredAt IS NULL` (not a blind update by seller id alone), so a
 * concurrent double-restore affects 0 rows instead of overwriting
 * restoredByAdminId/restoredAt a second time.
 */
export async function restoreSeller(input: {
  sellerUserId: string
  reason: string
  adminUserId: string
}): Promise<void> {
  const result = await db
    .update(sellerArchive)
    .set({ restoredAt: new Date(), restoredByAdminId: input.adminUserId })
    .where(and(eq(sellerArchive.sellerUserId, input.sellerUserId), sql`${sellerArchive.restoredAt} IS NULL`))
    .returning({ id: sellerArchive.id })

  if (result.length === 0) {
    throw new Error("Seller is not currently archived")
  }

  await writeReputationAction({
    sellerUserId: input.sellerUserId,
    actionType: "restored",
    reason: input.reason,
    adminUserId: input.adminUserId,
  })
}
```

```ts
// features/reviews/db/reputation-actions.ts — modify archiveSeller's
// onConflictDoUpdate `set` object (the whole function body is unchanged
// otherwise):
    .onConflictDoUpdate({
      target: sellerArchive.sellerUserId,
      set: {
        reason: input.reason,
        archivedByAdminId: input.adminUserId,
        archivedAt: new Date(),
        restoredAt: null,
        restoredByAdminId: null,
      },
    })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:unit -- reputation-archive reputation-actions`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/reviews/db/reputation-archive.ts features/reviews/db/reputation-actions.ts \
  tests/unit/reputation-archive.test.ts tests/unit/reputation-actions.test.ts
git commit -m "Add archived-sellers list + restore mutation, fix re-archive's restoredByAdminId"
```

---

### Task 2: Restore Zod schema + server action

**Preconditions:** Task 1 complete.

**Files:**
- Modify: `features/reviews/schemas/reputation-actions.ts`
- Modify: `features/reviews/actions/reputation-cases.ts`
- Test: `tests/api/reputation-cases-actions.test.ts` (extend)

**Interfaces:**
- Consumes: `restoreSeller` from Task 1
- Produces: `restoreSellerSchema`, `type RestoreSellerInput`, `restoreSellerAction(formData: FormData): Promise<{success:true}|{error:string}>`
- Consumed by: Task 3 (`ArchivedSellersTable`)

- [ ] **Step 1: Write the failing test**

```ts
// tests/api/reputation-cases-actions.test.ts — add to the existing vi.mock for
// "@/features/reviews/db/reputation-actions" AND add a new mock + describe
// block. The file already mocks next/headers, @/lib/auth,
// @/features/rbac/db/permissions, and @/features/reviews/db/reputation-actions
// — extend the last one and add one more:
vi.mock("@/features/reviews/db/reputation-archive", () => ({
  restoreSeller: vi.fn().mockResolvedValue(undefined),
}))
// ...then alongside the existing imports:
const { restoreSeller } = await import("@/features/reviews/db/reputation-archive")
const { restoreSellerAction } = await import("@/features/reviews/actions/reputation-cases")

describe("restoreSellerAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects with no session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    const result = await restoreSellerAction(form({ sellerUserId: "s1", reason: "Appeal upheld" }))
    expect(result).toEqual({ error: "Unauthorized" })
    expect(restoreSeller).not.toHaveBeenCalled()
  })

  it("rejects a missing reason", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    const result = await restoreSellerAction(form({ sellerUserId: "s1", reason: "" }))
    expect("error" in result).toBe(true)
    expect(restoreSeller).not.toHaveBeenCalled()
  })

  it("restores for an admin with a valid reason", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    const result = await restoreSellerAction(form({ sellerUserId: "s1", reason: "Appeal upheld" }))
    expect(result).toEqual({ success: true })
    expect(restoreSeller).toHaveBeenCalledWith({
      sellerUserId: "s1",
      reason: "Appeal upheld",
      adminUserId: "admin-1",
    })
  })

  it("allows internal staff who hold the reviews permission (same bar as archive/dismiss)", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "staff-1", role: "internal" } } as never)
    vi.mocked(checkInternalAccess).mockResolvedValue(true)
    const result = await restoreSellerAction(form({ sellerUserId: "s1", reason: "x" }))
    expect(result).toEqual({ success: true })
  })

  it("surfaces a DB throw as { error } instead of an unhandled rejection", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    vi.mocked(restoreSeller).mockRejectedValueOnce(new Error("Seller is not currently archived"))
    const result = await restoreSellerAction(form({ sellerUserId: "s1", reason: "x" }))
    expect(result).toEqual({ error: "Seller is not currently archived" })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:api -- reputation-cases-actions`
Expected: FAIL — `restoreSellerAction` is not exported.

- [ ] **Step 3: Implement**

```ts
// features/reviews/schemas/reputation-actions.ts — add:
export const restoreSellerSchema = z.object({
  sellerUserId: z.string().min(1, "Seller is required"),
  reason: z.string().min(1, "A reason is required"),
})
export type RestoreSellerInput = z.infer<typeof restoreSellerSchema>
```

```ts
// features/reviews/actions/reputation-cases.ts — add the import and the
// action. Do not touch requireReviewsSession/mutationErrorMessage/ActionResult
// — reuse them as-is.
import { restoreSeller } from "@/features/reviews/db/reputation-archive"
import {
  archiveSellerSchema,
  dismissCaseSchema,
  secondaryActionSchema,
  bulkArchiveSchema,
  bulkDismissSchema,
  restoreSellerSchema,
} from "@/features/reviews/schemas/reputation-actions"

// ... (after recordSecondaryActionAction, before bulkArchiveSellersAction)

export async function restoreSellerAction(formData: FormData): Promise<ActionResult> {
  const parsed = restoreSellerSchema.safeParse({
    sellerUserId: formData.get("sellerUserId"),
    reason: formData.get("reason"),
  })
  if (!parsed.success) return { error: zodErrorMessage(parsed.error) }

  const session = await requireReviewsSession()
  if (!session) return { error: "Unauthorized" }

  try {
    await restoreSeller({
      sellerUserId: parsed.data.sellerUserId,
      reason: parsed.data.reason,
      adminUserId: session.user.id,
    })
  } catch (err) {
    return { error: mutationErrorMessage(err, "Failed to restore seller") }
  }
  return { success: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:api -- reputation-cases-actions`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/reviews/schemas/reputation-actions.ts features/reviews/actions/reputation-cases.ts \
  tests/api/reputation-cases-actions.test.ts
git commit -m "Add restoreSellerAction with reason validation and the standard Reviews session gate"
```

---

### Task 3: Archived sellers page + table component

**Preconditions:** Tasks 1–2 complete.

**Files:**
- Create: `features/reviews/components/ArchivedSellersTable.tsx`
- Modify: `app/admin/reviews/archived/page.tsx` (replaces the `ComingSoonView` body)
- Test: `tests/component/archived-sellers-table.test.tsx`

**Interfaces:**
- Consumes: `getArchivedSellers`, `type ArchivedSeller` (Task 1); `restoreSellerAction` (Task 2); `ListViewCard`, `ColumnDef` (`@/components/admin/list-view`)

- [ ] **Step 1: Write the failing test**

```tsx
// tests/component/archived-sellers-table.test.tsx
import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { afterEach } from "vitest"
import { ArchivedSellersTable } from "@/features/reviews/components/ArchivedSellersTable"
import type { ArchivedSeller } from "@/features/reviews/db/reputation-archive"

afterEach(() => cleanup())

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/features/reviews/actions/reputation-cases", () => ({
  restoreSellerAction: vi.fn().mockResolvedValue({ success: true }),
}))

const SELLER: ArchivedSeller = {
  sellerUserId: "seller-1",
  sellerName: "Pyin Oo Lwin Stones",
  sellerImage: null,
  reason: "Below 3.8 for 6 days",
  archivedByAdminId: "admin-1",
  archivedByAdminName: "Admin One",
  archivedAt: new Date("2026-08-01T00:00:00Z"),
  appealStatus: "none",
}

describe("ArchivedSellersTable", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders the seller, reason, and archived-by admin", () => {
    render(<ArchivedSellersTable sellers={[SELLER]} page={1} pageSize={20} total={1} />)
    expect(screen.getByText("Pyin Oo Lwin Stones")).toBeInTheDocument()
    expect(screen.getByText("Below 3.8 for 6 days")).toBeInTheDocument()
    expect(screen.getByText("Admin One")).toBeInTheDocument()
  })

  it("shows a since-deleted-admin fallback when archivedByAdminId is null", () => {
    render(
      <ArchivedSellersTable
        sellers={[{ ...SELLER, archivedByAdminId: null, archivedByAdminName: null }]}
        page={1}
        pageSize={20}
        total={1}
      />
    )
    expect(screen.getByText(/since-deleted admin/i)).toBeInTheDocument()
  })

  it("requires a reason before confirming a restore", async () => {
    const { restoreSellerAction } = await import("@/features/reviews/actions/reputation-cases")
    render(<ArchivedSellersTable sellers={[SELLER]} page={1} pageSize={20} total={1} />)
    fireEvent.click(screen.getByText("Restore"))
    const confirmBtn = screen.getByRole("button", { name: /Confirm Restore/i })
    expect(confirmBtn).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText(/Reason for the decision/i), {
      target: { value: "Appeal upheld" },
    })
    expect(confirmBtn).not.toBeDisabled()
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(restoreSellerAction).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:component -- archived-sellers-table`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```tsx
// features/reviews/components/ArchivedSellersTable.tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ListViewCard } from "@/components/admin/list-view"
import type { ColumnDef } from "@/components/admin/list-view"
import type { ArchivedSeller } from "@/features/reviews/db/reputation-archive"
import { restoreSellerAction } from "@/features/reviews/actions/reputation-cases"

function buildPageHref(page: number): string {
  const p = new URLSearchParams()
  p.set("page", String(page))
  return `/admin/reviews/archived?${p.toString()}`
}

type Row = ArchivedSeller & { id: string }

type Props = {
  sellers: ArchivedSeller[]
  page: number
  pageSize: number
  total: number
}

export function ArchivedSellersTable({ sellers, page, pageSize, total }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [target, setTarget] = useState<Row | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  const rows: Row[] = sellers.map((s) => ({ ...s, id: s.sellerUserId }))

  async function confirmRestore() {
    if (!target) return
    setBusy(true)
    try {
      const form = new FormData()
      form.set("sellerUserId", target.sellerUserId)
      form.set("reason", reason.trim())
      const result = await restoreSellerAction(form)
      if ("error" in result) {
        toast.error("Restore failed", { description: result.error })
        return
      }
      toast.success("Seller restored")
      setTarget(null)
      startTransition(() => router.refresh())
    } finally {
      setBusy(false)
    }
  }

  const columnDefs: ColumnDef<Row>[] = [
    {
      id: "seller",
      label: "Seller",
      flex: true,
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{r.sellerName}</div>
          <div style={{ fontSize: 12.5, color: "#52525B", marginTop: 4 }}>{r.reason}</div>
        </div>
      ),
    },
    {
      id: "archivedBy",
      label: "Archived by",
      width: 160,
      render: (r) => <span>{r.archivedByAdminName ?? "a since-deleted admin"}</span>,
    },
    {
      id: "archivedAt",
      label: "Archived",
      width: 140,
      render: (r) => <span>{new Date(r.archivedAt).toLocaleDateString()}</span>,
    },
  ]

  return (
    <>
      <ListViewCard
        rows={rows}
        columnDefs={columnDefs}
        rowActions={(r, disabled) => (
          <button
            className="lv-rowbtn"
            disabled={disabled}
            onClick={() => {
              setTarget(r)
              setReason("")
            }}
          >
            Restore
          </button>
        )}
        page={page}
        pageSize={pageSize}
        total={total}
        buildPageHref={buildPageHref}
        emptyMessage="No archived sellers right now."
      />

      <Dialog open={target !== null} onOpenChange={(v) => { if (!busy && !v) setTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Restore {target?.sellerName}</DialogTitle>
            <DialogDescription>
              Clears the archive record. Their profile was never hidden from buyers in phase 1, so
              this is an audit-trail correction, not a re-publish action.
            </DialogDescription>
          </DialogHeader>
          <textarea
            placeholder="Reason for the decision (stored in the audit log)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            disabled={busy}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={confirmRestore} disabled={busy || !reason.trim()}>
              {busy ? "Restoring…" : "Confirm Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

```tsx
// app/admin/reviews/archived/page.tsx — full replacement
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getArchivedSellers } from "@/features/reviews/db/reputation-archive"
import { ArchivedSellersTable } from "@/features/reviews/components/ArchivedSellersTable"
import { withQueryTimeout } from "@/lib/query-timeout"

const QUERY_TIMEOUT_MS = 6000
const PAGE_SIZE = 20

type Props = {
  searchParams: Promise<{ page?: string }>
}

export default async function AdminReviewsArchivedPage({ searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.REVIEWS)

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)

  const { sellers, total } = await withQueryTimeout(
    getArchivedSellers({ page, limit: PAGE_SIZE }),
    QUERY_TIMEOUT_MS,
    "archived-sellers-page"
  )

  return (
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <span>Admin</span> <span>›</span> <span>Reviews</span> <span>›</span>{" "}
            <span className="lv-here">Archived sellers</span>
          </nav>
          <h1 className="lv-h1">Archived sellers</h1>
          <p className="lv-subhead">
            Archived and excluded from open cases. Restoring clears the archive record — phase 1
            never hides a listing from buyers, so nothing is being &quot;republished.&quot;
          </p>
        </div>
      </div>

      <ArchivedSellersTable sellers={sellers} page={page} pageSize={PAGE_SIZE} total={total} />
    </div>
  )
}
```

Note: the subhead above intentionally corrects the placeholder's old, self-contradictory copy ("Restoring republishes the profile") flagged in phase 1's final review — it no longer implies archiving un-published anything.

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:component -- archived-sellers-table`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/reviews/archived/page.tsx features/reviews/components/ArchivedSellersTable.tsx \
  tests/component/archived-sellers-table.test.tsx
git commit -m "Build the Archived sellers admin view with Restore"
```

---

### Task 4: Threshold toggle DB layer

**Preconditions:** None — extends phase 1's existing `reputation-thresholds.ts`.

**Files:**
- Modify: `features/reviews/db/reputation-thresholds.ts`
- Test: `tests/unit/reputation-thresholds.test.ts` (extend)

**Interfaces:**
- Consumes: `writeReputationAction` (`./reputation-actions`)
- Produces: `toggleThreshold(input: { thresholdId: ThresholdId; enabled: boolean; adminUserId: string; reason: string }): Promise<void>`
- Consumed by: Task 5 (`toggleThresholdAction`)

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/reputation-thresholds.test.ts — add these mocks alongside the
// existing ones at the top of the file, and this describe block at the end.
// The existing file mocks drizzle-orm with only `eq`; extend that mock to
// also export `eq` correctly typed for a real .where() call (it already
// does — reuse it), and add the new module mock:
vi.mock("@/features/reviews/db/reputation-actions", () => ({
  writeReputationAction: vi.fn().mockResolvedValue(undefined),
}))

// ... after the existing imports:
import { writeReputationAction } from "@/features/reviews/db/reputation-actions"
import { toggleThreshold } from "@/features/reviews/db/reputation-thresholds"

describe("toggleThreshold", () => {
  beforeEach(() => vi.clearAllMocks())

  it("updates enabled and writes a threshold_toggled audit action with a null sellerUserId", async () => {
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }),
    } as never)
    const rows = [
      { id: "rating_below_archive", enabled: true, dataAvailable: true, sortOrder: 1, label: "x", logicDescription: "y" },
    ]
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(rows) }),
    } as never)
    const whereMock = vi.fn().mockResolvedValue(undefined)
    const setMock = vi.fn().mockReturnValue({ where: whereMock })
    vi.mocked(db.update).mockReturnValue({ set: setMock } as never)

    await toggleThreshold({
      thresholdId: "rating_below_archive",
      enabled: false,
      adminUserId: "admin-1",
      reason: "Too noisy this week",
    })

    expect(setMock).toHaveBeenCalledWith({ enabled: false })
    expect(writeReputationAction).toHaveBeenCalledWith({
      sellerUserId: null,
      actionType: "threshold_toggled",
      triggerKey: "rating_below_archive",
      reason: "Too noisy this week",
      adminUserId: "admin-1",
    })
  })

  it("rejects enabling a rule with no data source, without writing an audit action", async () => {
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }),
    } as never)
    const rows = [
      { id: "non_delivery_reports", enabled: false, dataAvailable: false, sortOrder: 4, label: "x", logicDescription: "y" },
    ]
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(rows) }),
    } as never)

    await expect(
      toggleThreshold({
        thresholdId: "non_delivery_reports",
        enabled: true,
        adminUserId: "admin-1",
        reason: "x",
      })
    ).rejects.toThrow(/no data source/i)
    expect(db.update).not.toHaveBeenCalled()
    expect(writeReputationAction).not.toHaveBeenCalled()
  })

  it("throws on an unknown threshold id", async () => {
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }),
    } as never)
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) }),
    } as never)

    await expect(
      toggleThreshold({
        thresholdId: "rating_below_archive",
        enabled: true,
        adminUserId: "admin-1",
        reason: "x",
      })
    ).rejects.toThrow(/unknown/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:unit -- reputation-thresholds`
Expected: FAIL — `toggleThreshold` is not exported.

- [ ] **Step 3: Implement**

```ts
// features/reviews/db/reputation-thresholds.ts — add the eq import and the
// writeReputationAction import at the top, and the function at the bottom.
// Everything else in the file (ensureThresholdsSeeded, getThresholds,
// getEnabledThresholdIds) is unchanged.
import { eq } from "drizzle-orm"
import { writeReputationAction } from "./reputation-actions"

// ... (after getEnabledThresholdIds)

/**
 * Toggles a rule's enabled flag and records why. Rejects enabling a rule
 * that has no data source (dataAvailable: false) — server-side, not just a
 * disabled UI control, since this is called directly by a server action.
 */
export async function toggleThreshold(input: {
  thresholdId: ThresholdId
  enabled: boolean
  adminUserId: string
  reason: string
}): Promise<void> {
  const rows = await getThresholds()
  const target = rows.find((r) => r.id === input.thresholdId)
  if (!target) throw new Error("Unknown threshold rule")
  if (input.enabled && !target.dataAvailable) {
    throw new Error("This rule has no data source yet and cannot be enabled")
  }

  await db
    .update(reputationThreshold)
    .set({ enabled: input.enabled })
    .where(eq(reputationThreshold.id, input.thresholdId))

  await writeReputationAction({
    sellerUserId: null,
    actionType: "threshold_toggled",
    triggerKey: input.thresholdId,
    reason: input.reason,
    adminUserId: input.adminUserId,
  })
}
```

(`type ThresholdId` and `reputationThreshold` are already imported/defined earlier in this file from phase 1 — no new import needed for either. The `import type { ThresholdId } from "./reputation-thresholds"` in `reputation-actions.ts` is type-only, so this new runtime import of `writeReputationAction` back into `reputation-thresholds.ts` does not create a circular runtime dependency.)

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:unit -- reputation-thresholds`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/reviews/db/reputation-thresholds.ts tests/unit/reputation-thresholds.test.ts
git commit -m "Add toggleThreshold with server-side dataAvailable guard"
```

---

### Task 5: Toggle Zod schema + admin-only server action

**Preconditions:** Task 4 complete.

**Files:**
- Modify: `features/reviews/schemas/reputation-actions.ts`
- Modify: `features/reviews/actions/reputation-cases.ts`
- Test: `tests/api/reputation-cases-actions.test.ts` (extend)

**Interfaces:**
- Consumes: `toggleThreshold` (Task 4)
- Produces: `toggleThresholdSchema`, `type ToggleThresholdInput`, `toggleThresholdAction(formData: FormData): Promise<{success:true}|{error:string}>`
- Consumed by: Task 6 (`ThresholdsList`)

- [ ] **Step 1: Write the failing test**

```ts
// tests/api/reputation-cases-actions.test.ts — extend the mock for
// "@/features/reviews/db/reputation-thresholds" (add it — the file doesn't
// mock this module yet) and add:
vi.mock("@/features/reviews/db/reputation-thresholds", () => ({
  toggleThreshold: vi.fn().mockResolvedValue(undefined),
}))

const { toggleThreshold } = await import("@/features/reviews/db/reputation-thresholds")
const { toggleThresholdAction } = await import("@/features/reviews/actions/reputation-cases")

function toggleForm(fields: { thresholdId: string; enabled: string; reason: string }): FormData {
  return form(fields)
}

describe("toggleThresholdAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects with no session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    const result = await toggleThresholdAction(
      toggleForm({ thresholdId: "rating_below_archive", enabled: "false", reason: "x" })
    )
    expect(result).toEqual({ error: "Unauthorized — only admins can change threshold rules" })
    expect(toggleThreshold).not.toHaveBeenCalled()
  })

  it("rejects internal staff even when they hold the reviews permission — admin only", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "staff-1", role: "internal" } } as never)
    vi.mocked(checkInternalAccess).mockResolvedValue(true)
    const result = await toggleThresholdAction(
      toggleForm({ thresholdId: "rating_below_archive", enabled: "false", reason: "x" })
    )
    expect(result).toEqual({ error: "Unauthorized — only admins can change threshold rules" })
    expect(toggleThreshold).not.toHaveBeenCalled()
    // checkInternalAccess must never even be consulted for this action — the
    // bar is role === "admin", not "internal + has the key".
    expect(checkInternalAccess).not.toHaveBeenCalled()
  })

  it("rejects a missing reason", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    const result = await toggleThresholdAction(
      toggleForm({ thresholdId: "rating_below_archive", enabled: "false", reason: "" })
    )
    expect("error" in result).toBe(true)
    expect(toggleThreshold).not.toHaveBeenCalled()
  })

  it("rejects an unknown thresholdId at the Zod layer", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    const result = await toggleThresholdAction(
      toggleForm({ thresholdId: "not_a_real_rule", enabled: "false", reason: "x" })
    )
    expect("error" in result).toBe(true)
    expect(toggleThreshold).not.toHaveBeenCalled()
  })

  it("toggles for an admin with a valid reason", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    const result = await toggleThresholdAction(
      toggleForm({ thresholdId: "rating_below_archive", enabled: "false", reason: "Too noisy" })
    )
    expect(result).toEqual({ success: true })
    expect(toggleThreshold).toHaveBeenCalledWith({
      thresholdId: "rating_below_archive",
      enabled: false,
      reason: "Too noisy",
      adminUserId: "admin-1",
    })
  })

  it("surfaces the DB layer's dataAvailable rejection as { error }", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    vi.mocked(toggleThreshold).mockRejectedValueOnce(
      new Error("This rule has no data source yet and cannot be enabled")
    )
    const result = await toggleThresholdAction(
      toggleForm({ thresholdId: "non_delivery_reports", enabled: "true", reason: "x" })
    )
    expect(result).toEqual({ error: "This rule has no data source yet and cannot be enabled" })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:api -- reputation-cases-actions`
Expected: FAIL — `toggleThresholdAction` is not exported.

- [ ] **Step 3: Implement**

```ts
// features/reviews/schemas/reputation-actions.ts — add:
export const toggleThresholdSchema = z.object({
  thresholdId: z.enum(THRESHOLD_IDS),
  enabled: z.boolean(),
  reason: z.string().min(1, "A reason is required"),
})
export type ToggleThresholdInput = z.infer<typeof toggleThresholdSchema>
```

```ts
// features/reviews/actions/reputation-cases.ts — add the import, the new
// local admin-only session helper, and the action.
import { toggleThreshold } from "@/features/reviews/db/reputation-thresholds"
import {
  archiveSellerSchema,
  dismissCaseSchema,
  secondaryActionSchema,
  bulkArchiveSchema,
  bulkDismissSchema,
  restoreSellerSchema,
  toggleThresholdSchema,
} from "@/features/reviews/schemas/reputation-actions"

// ... (alongside requireReviewsSession)

/**
 * Stricter than requireReviewsSession: toggling a rule changes case
 * detection marketplace-wide, not for one seller, so internal staff holding
 * FEATURE_KEYS.REVIEWS are not enough here — full admin only. See the
 * phase-2 design spec's Thresholds section.
 */
async function requireAdminSession(): Promise<{ user: { id: string; role: string } } | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") return null
  return session
}

// ... (after restoreSellerAction)

export async function toggleThresholdAction(formData: FormData): Promise<ActionResult> {
  const parsed = toggleThresholdSchema.safeParse({
    thresholdId: formData.get("thresholdId"),
    enabled: formData.get("enabled") === "true",
    reason: formData.get("reason"),
  })
  if (!parsed.success) return { error: zodErrorMessage(parsed.error) }

  const session = await requireAdminSession()
  if (!session) return { error: "Unauthorized — only admins can change threshold rules" }

  try {
    await toggleThreshold({
      thresholdId: parsed.data.thresholdId,
      enabled: parsed.data.enabled,
      reason: parsed.data.reason,
      adminUserId: session.user.id,
    })
  } catch (err) {
    return { error: mutationErrorMessage(err, "Failed to update the rule") }
  }
  return { success: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:api -- reputation-cases-actions`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/reviews/schemas/reputation-actions.ts features/reviews/actions/reputation-cases.ts \
  tests/api/reputation-cases-actions.test.ts
git commit -m "Add admin-only toggleThresholdAction"
```

---

### Task 6: Thresholds page + list component

**Preconditions:** Tasks 4–5 complete.

**Files:**
- Create: `features/reviews/components/ThresholdsList.tsx`
- Modify: `app/admin/reviews/thresholds/page.tsx`
- Test: `tests/component/thresholds-list.test.tsx`

**Interfaces:**
- Consumes: `getThresholds`, `type ThresholdRow` (`./reputation-thresholds`); `toggleThresholdAction` (Task 5)

- [ ] **Step 1: Write the failing test**

```tsx
// tests/component/thresholds-list.test.tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { ThresholdsList } from "@/features/reviews/components/ThresholdsList"
import type { ThresholdRow } from "@/features/reviews/db/reputation-thresholds"

afterEach(() => cleanup())

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/features/reviews/actions/reputation-cases", () => ({
  toggleThresholdAction: vi.fn().mockResolvedValue({ success: true }),
}))

const ROWS: ThresholdRow[] = [
  { id: "rating_below_archive", label: "Rating below archive threshold", logicDescription: "Rating < 3.80 with ≥ 30 reviews", enabled: true, sortOrder: 1, dataAvailable: true },
  { id: "non_delivery_reports", label: "Non-delivery reports", logicDescription: "≥ 3 buyers report no shipment", enabled: false, sortOrder: 4, dataAvailable: false },
  { id: "auto_archive", label: "Auto-archive on threshold breach", logicDescription: "Archive without an admin decision", enabled: false, sortOrder: 6, dataAvailable: true },
]

describe("ThresholdsList", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders all 6 rules with their logic descriptions", () => {
    render(<ThresholdsList rules={ROWS} isAdmin={true} />)
    expect(screen.getByText("Rating below archive threshold")).toBeInTheDocument()
    expect(screen.getByText(/Rating < 3.80/)).toBeInTheDocument()
  })

  it("disables the toggle and shows a note for a rule with no data source", () => {
    render(<ThresholdsList rules={ROWS} isAdmin={true} />)
    const nonDelivery = screen.getByText("Non-delivery reports").closest("[data-rule]") as HTMLElement
    expect(nonDelivery).toHaveTextContent(/not available yet/i)
    const toggle = nonDelivery.querySelector("button[role='switch']") as HTMLElement
    expect(toggle).toBeDisabled()
  })

  it("keeps auto_archive's toggle live but shows a no-scheduler note", () => {
    render(<ThresholdsList rules={ROWS} isAdmin={true} />)
    const autoArchive = screen.getByText("Auto-archive on threshold breach").closest("[data-rule]") as HTMLElement
    expect(autoArchive).toHaveTextContent(/no scheduler/i)
    const toggle = autoArchive.querySelector("button[role='switch']") as HTMLElement
    expect(toggle).not.toBeDisabled()
  })

  it("hides every toggle for a non-admin viewer, view-only", () => {
    render(<ThresholdsList rules={ROWS} isAdmin={false} />)
    expect(screen.queryAllByRole("switch")).toHaveLength(0)
    expect(screen.getByText(/view-only/i)).toBeInTheDocument()
  })

  it("requires a reason before confirming a toggle", async () => {
    const { toggleThresholdAction } = await import("@/features/reviews/actions/reputation-cases")
    render(<ThresholdsList rules={ROWS} isAdmin={true} />)
    const rating = screen.getByText("Rating below archive threshold").closest("[data-rule]") as HTMLElement
    fireEvent.click(rating.querySelector("button[role='switch']") as HTMLElement)
    const confirmBtn = screen.getByRole("button", { name: /Confirm/i })
    expect(confirmBtn).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText(/Reason for the decision/i), {
      target: { value: "Too noisy this week" },
    })
    expect(confirmBtn).not.toBeDisabled()
    fireEvent.click(confirmBtn)
    await waitFor(() =>
      expect(toggleThresholdAction).toHaveBeenCalled()
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:component -- thresholds-list`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```tsx
// features/reviews/components/ThresholdsList.tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ThresholdRow } from "@/features/reviews/db/reputation-thresholds"
import { toggleThresholdAction } from "@/features/reviews/actions/reputation-cases"

type Props = {
  rules: ThresholdRow[]
  isAdmin: boolean
}

export function ThresholdsList({ rules, isAdmin }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [target, setTarget] = useState<{ rule: ThresholdRow; nextEnabled: boolean } | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  async function confirmToggle() {
    if (!target) return
    setBusy(true)
    try {
      const form = new FormData()
      form.set("thresholdId", target.rule.id)
      form.set("enabled", String(target.nextEnabled))
      form.set("reason", reason.trim())
      const result = await toggleThresholdAction(form)
      if ("error" in result) {
        toast.error("Update failed", { description: result.error })
        return
      }
      toast.success(`${target.rule.label} ${target.nextEnabled ? "enabled" : "disabled"}`)
      setTarget(null)
      startTransition(() => router.refresh())
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {!isAdmin && (
        <div className="lv-card" style={{ padding: "12px 16px", marginBottom: 12, fontSize: 13, color: "var(--lv-text-3, #71717a)" }}>
          View-only — changing a rule requires full admin access.
        </div>
      )}
      <div className="lv-card" style={{ padding: 0 }}>
        {rules.map((rule) => (
          <div
            key={rule.id}
            data-rule={rule.id}
            style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "16px 18px", borderBottom: "1px solid #F4F4F6" }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{rule.label}</div>
              <div style={{ fontSize: 13, color: "#52525B", marginTop: 2 }}>{rule.logicDescription}</div>
              {!rule.dataAvailable && (
                <div style={{ fontSize: 12, color: "#B45309", marginTop: 6 }}>
                  Not available yet — no data source exists for this rule.
                </div>
              )}
              {rule.id === "auto_archive" && (
                <div style={{ fontSize: 12, color: "#B45309", marginTop: 6 }}>
                  Enabling this has no automatic effect yet — no scheduler exists to act on it.
                </div>
              )}
            </div>
            {isAdmin && (
              <Switch
                checked={rule.enabled}
                disabled={!rule.dataAvailable && !rule.enabled}
                onCheckedChange={(next) => {
                  setTarget({ rule, nextEnabled: next })
                  setReason("")
                }}
              />
            )}
          </div>
        ))}
      </div>

      <Dialog open={target !== null} onOpenChange={(v) => { if (!busy && !v) setTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">
              {target?.nextEnabled ? "Enable" : "Disable"} {target?.rule.label}
            </DialogTitle>
            <DialogDescription>
              This changes case detection for every seller in the marketplace, not just one.
            </DialogDescription>
          </DialogHeader>
          <textarea
            placeholder="Reason for the decision (stored in the audit log)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            disabled={busy}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={confirmToggle} disabled={busy || !reason.trim()}>
              {busy ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

`components/ui/switch.tsx` (shadcn's `Switch` primitive, Radix-based — renders with `role="switch"`) already exists in this repo; import it as shown above, no scaffolding step needed.

```tsx
// app/admin/reviews/thresholds/page.tsx — full replacement
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getThresholds } from "@/features/reviews/db/reputation-thresholds"
import { ThresholdsList } from "@/features/reviews/components/ThresholdsList"

export default async function AdminReviewsThresholdsPage() {
  await connection()
  const session = await requireFeatureAccess(FEATURE_KEYS.REVIEWS)
  const isAdmin = session.user.role === "admin"

  const rules = await getThresholds()

  return (
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <span>Admin</span> <span>›</span> <span>Reviews</span> <span>›</span>{" "}
            <span className="lv-here">Case thresholds</span>
          </nav>
          <h1 className="lv-h1">Case thresholds</h1>
          <p className="lv-subhead">
            What opens a reputation case, and how the seller rating tags feed those rules.
          </p>
        </div>
      </div>

      <ThresholdsList rules={rules} isAdmin={isAdmin} />
    </div>
  )
}
```

`requireFeatureAccess` (`lib/admin-guard.ts`) already returns the session object on every path that doesn't `redirect()`, so `session.user.role` is available directly — no second `auth.api.getSession()` call needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:component -- thresholds-list`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/reviews/thresholds/page.tsx features/reviews/components/ThresholdsList.tsx \
  tests/component/thresholds-list.test.tsx
git commit -m "Build the Thresholds admin view with admin-only toggles"
```

---

### Task 7: Overview DB layer

**Preconditions:** None — reuses phase 1's `getReputationBadgeCounts`.

**Files:**
- Create: `features/reviews/db/reputation-overview.ts`
- Test: `tests/unit/reputation-overview.test.ts`

**Interfaces:**
- Consumes: `getReputationBadgeCounts` (`./reputation-cases`)
- Produces: `type RecentAuditEntry`, `type ReputationOverview`, `getReputationOverview(): Promise<ReputationOverview>`
- Consumed by: Task 8

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/reputation-overview.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("drizzle-orm", () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    { raw: (s: string) => s }
  ),
}))
vi.mock("@/drizzle/schema/seller-rating-schema", () => ({
  sellerRating: { score: "score" },
}))
vi.mock("@/drizzle/schema/reputation-schema", () => ({
  sellerReputationAction: {
    id: "id", actionType: "action_type", sellerUserId: "seller_user_id",
    reason: "reason", createdAt: "created_at",
  },
}))
vi.mock("@/lib/query-timeout", () => ({
  withQueryTimeout: vi.fn((p: Promise<unknown>) => p),
}))
vi.mock("@/features/reviews/db/reputation-cases", () => ({
  getReputationBadgeCounts: vi.fn().mockResolvedValue({ openCases: 3, archivedSellers: 2 }),
}))
vi.mock("@/drizzle/db", () => ({
  db: { select: vi.fn() },
}))

import { db } from "@/drizzle/db"
import { getReputationOverview } from "@/features/reviews/db/reputation-overview"

describe("getReputationOverview", () => {
  beforeEach(() => vi.clearAllMocks())

  it("combines badge counts, marketplace average, and recent activity", async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockResolvedValue([{ avg: 4.12 }]),
    } as never)
    const recentRows = [
      { id: "a1", actionType: "archived", sellerUserId: "seller-1", reason: "x", createdAt: new Date("2026-08-01") },
    ]
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(recentRows) }),
      }),
    } as never)

    const result = await getReputationOverview()

    expect(result).toEqual({
      openCases: 3,
      archivedSellers: 2,
      marketplaceAvgRating: 4.12,
      recentActivity: recentRows,
    })
  })

  it("defaults the marketplace average to 0 when there are no ratings at all", async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockResolvedValue([{ avg: 0 }]),
    } as never)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    } as never)

    const result = await getReputationOverview()

    expect(result.marketplaceAvgRating).toBe(0)
    expect(result.recentActivity).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:unit -- reputation-overview`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// features/reviews/db/reputation-overview.ts
import { sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { sellerRating } from "@/drizzle/schema/seller-rating-schema"
import { sellerReputationAction } from "@/drizzle/schema/reputation-schema"
import { withQueryTimeout } from "@/lib/query-timeout"
import { getReputationBadgeCounts } from "./reputation-cases"

const QUERY_TIMEOUT_MS = 6000

export type RecentAuditEntry = {
  id: string
  actionType: string
  sellerUserId: string | null
  reason: string | null
  createdAt: Date
}

export type ReputationOverview = {
  openCases: number
  archivedSellers: number
  marketplaceAvgRating: number
  recentActivity: RecentAuditEntry[]
}

/** KPI summary for the Overview landing page. Three sequential queries, no rule matching. */
export async function getReputationOverview(): Promise<ReputationOverview> {
  const badgeCounts = await getReputationBadgeCounts()

  const avgResult = await withQueryTimeout(
    db
      .select({ avg: sql<number>`coalesce(avg(${sellerRating.score}), 0)` })
      .from(sellerRating),
    QUERY_TIMEOUT_MS,
    "overview-marketplace-avg"
  )
  const marketplaceAvgRating = Number(avgResult[0]?.avg ?? 0)

  const recentActivity = await withQueryTimeout(
    db
      .select({
        id: sellerReputationAction.id,
        actionType: sellerReputationAction.actionType,
        sellerUserId: sellerReputationAction.sellerUserId,
        reason: sellerReputationAction.reason,
        createdAt: sellerReputationAction.createdAt,
      })
      .from(sellerReputationAction)
      .orderBy(sql`${sellerReputationAction.createdAt} DESC`)
      .limit(5),
    QUERY_TIMEOUT_MS,
    "overview-recent-activity"
  )

  return {
    openCases: badgeCounts.openCases,
    archivedSellers: badgeCounts.archivedSellers,
    marketplaceAvgRating,
    recentActivity,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:unit -- reputation-overview`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/reviews/db/reputation-overview.ts tests/unit/reputation-overview.test.ts
git commit -m "Add Overview KPI query"
```

---

### Task 8: Overview page + component

**Preconditions:** Task 7 complete.

**Files:**
- Create: `features/reviews/components/ReputationOverview.tsx`
- Modify: `app/admin/reviews/page.tsx`
- Test: `tests/component/reputation-overview.test.tsx`

**Interfaces:**
- Consumes: `type ReputationOverview` (Task 7)

- [ ] **Step 1: Write the failing test**

```tsx
// tests/component/reputation-overview.test.tsx
import { describe, expect, it, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { ReputationOverview } from "@/features/reviews/components/ReputationOverview"
import type { ReputationOverview as OverviewData } from "@/features/reviews/db/reputation-overview"

afterEach(() => cleanup())

const DATA: OverviewData = {
  openCases: 3,
  archivedSellers: 2,
  marketplaceAvgRating: 4.12,
  recentActivity: [
    { id: "a1", actionType: "archived", sellerUserId: "seller-1", reason: "Below 3.8", createdAt: new Date("2026-08-01T00:00:00Z") },
  ],
}

describe("ReputationOverview", () => {
  it("renders the three KPI tiles and the recent activity list", () => {
    render(<ReputationOverview data={DATA} />)
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("4.12")).toBeInTheDocument()
    expect(screen.getByText(/archived/i)).toBeInTheDocument()
  })

  it("shows an empty-state note when there is no recent activity", () => {
    render(<ReputationOverview data={{ ...DATA, recentActivity: [] }} />)
    expect(screen.getByText(/no recent activity/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:component -- reputation-overview`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```tsx
// features/reviews/components/ReputationOverview.tsx
import type { ReputationOverview as OverviewData } from "@/features/reviews/db/reputation-overview"

function fmtRelative(d: Date): string {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  const days = Math.floor(diff / 86400)
  if (days >= 1) return `${days}d ago`
  const hours = Math.max(1, Math.floor(diff / 3600))
  return `${hours}h ago`
}

const ACTION_LABELS: Record<string, string> = {
  archived: "Archived",
  restored: "Restored",
  dismissed: "Dismissed a flag on",
  warned: "Warned",
  limited_orders: "Limited orders for",
  listings_hidden: "Hid listings for",
  documents_requested: "Requested documents from",
  escalated: "Escalated",
  threshold_toggled: "Toggled a rule",
}

export function ReputationOverview({ data }: { data: OverviewData }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <div className="lv-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12.5, color: "var(--lv-text-3, #71717a)" }}>Open cases</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{data.openCases}</div>
        </div>
        <div className="lv-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12.5, color: "var(--lv-text-3, #71717a)" }}>Archived sellers</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{data.archivedSellers}</div>
        </div>
        <div className="lv-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12.5, color: "var(--lv-text-3, #71717a)" }}>Marketplace avg rating</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{data.marketplaceAvgRating.toFixed(2)}</div>
        </div>
      </div>

      <div className="lv-card" style={{ padding: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Recent activity</h3>
        {data.recentActivity.length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--lv-text-3, #71717a)" }}>No recent activity.</p>
        )}
        {data.recentActivity.map((entry) => (
          <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F4F4F6", fontSize: 13 }}>
            <span>
              {ACTION_LABELS[entry.actionType] ?? entry.actionType}
              {entry.sellerUserId ? ` seller ${entry.sellerUserId}` : ""}
              {entry.reason ? ` — ${entry.reason}` : ""}
            </span>
            <span style={{ color: "var(--lv-text-4, #a1a1aa)" }}>{fmtRelative(entry.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

```tsx
// app/admin/reviews/page.tsx — full replacement
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getReputationOverview } from "@/features/reviews/db/reputation-overview"
import { ReputationOverview } from "@/features/reviews/components/ReputationOverview"

export default async function AdminReviewsOverviewPage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.REVIEWS)

  const data = await getReputationOverview()

  return (
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <span>Admin</span> <span>›</span> <span className="lv-here">Reviews</span>
          </nav>
          <h1 className="lv-h1">Overview</h1>
          <p className="lv-subhead">
            Buyer reviews publish immediately. This is where the marketplace rating and seller
            reputation are monitored.
          </p>
        </div>
      </div>

      <ReputationOverview data={data} />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:component -- reputation-overview`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/reviews/page.tsx features/reviews/components/ReputationOverview.tsx \
  tests/component/reputation-overview.test.tsx
git commit -m "Build the Overview dashboard"
```

---

### Task 9: Seller ratings DB layer

**Preconditions:** None.

**Files:**
- Create: `features/reviews/db/reputation-sellers.ts`
- Test: `tests/unit/reputation-sellers.test.ts`

**Interfaces:**
- Produces: `type SellerRatingRow`, `getSellerRatings(opts: { page: number; limit: number }): Promise<{ sellers: SellerRatingRow[]; total: number }>`
- Consumed by: Task 10

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/reputation-sellers.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("drizzle-orm", () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    { raw: (s: string) => s }
  ),
}))
vi.mock("@/lib/query-timeout", () => ({
  withQueryTimeout: vi.fn((p: Promise<unknown>) => p),
}))
vi.mock("@/drizzle/db", () => ({
  db: { execute: vi.fn() },
}))

import { db } from "@/drizzle/db"
import { getSellerRatings } from "@/features/reviews/db/reputation-sellers"

describe("getSellerRatings", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns every rated seller with camelCased fields", async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([{ count: 1 }] as never)
      .mockResolvedValueOnce([
        {
          seller_user_id: "seller-1",
          seller_name: "Pyin Oo Lwin Stones",
          seller_image: null,
          avg_rating: 4.5,
          review_count: 12,
          negative_mix_pct: 8,
        },
      ] as never)

    const result = await getSellerRatings({ page: 1, limit: 20 })

    expect(result.total).toBe(1)
    expect(result.sellers[0]).toEqual({
      sellerUserId: "seller-1",
      sellerName: "Pyin Oo Lwin Stones",
      sellerImage: null,
      avgRating: 4.5,
      reviewCount: 12,
      negativeMixPct: 8,
    })
  })

  it("returns an empty page when nobody has been rated yet", async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([{ count: 0 }] as never)
      .mockResolvedValueOnce([] as never)

    const result = await getSellerRatings({ page: 1, limit: 20 })

    expect(result).toEqual({ sellers: [], total: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:unit -- reputation-sellers`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// features/reviews/db/reputation-sellers.ts
import { sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { withQueryTimeout } from "@/lib/query-timeout"

const QUERY_TIMEOUT_MS = 6000

export type SellerRatingRow = {
  sellerUserId: string
  sellerName: string
  sellerImage: string | null
  avgRating: number
  reviewCount: number
  negativeMixPct: number
}

/**
 * Every rated seller, independent of the case-computation engine — no rule
 * matching here. Ordered worst-rated-first (most actionable), scalar LIMIT/
 * OFFSET bind fine in a raw sql template (only embedded JS *arrays* need
 * sql.join — see Global Constraints).
 */
export async function getSellerRatings(opts: {
  page: number
  limit: number
}): Promise<{ sellers: SellerRatingRow[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit

  const totalResult = await withQueryTimeout(
    db.execute(sql`
      SELECT count(*)::int AS count FROM (
        SELECT seller_user_id FROM seller_rating GROUP BY seller_user_id
      ) t
    `),
    QUERY_TIMEOUT_MS,
    "seller-ratings-count"
  )
  const total = ([...totalResult] as Array<{ count: number }>)[0]?.count ?? 0
  if (total === 0) return { sellers: [], total: 0 }

  const rows = await withQueryTimeout(
    db.execute(sql`
      SELECT sr.seller_user_id,
             u.name AS seller_name,
             u.image AS seller_image,
             avg(sr.score) AS avg_rating,
             count(*)::int AS review_count,
             round(count(*) FILTER (WHERE sr.score <= 2)::numeric / count(*) * 100)::int AS negative_mix_pct
      FROM seller_rating sr
      JOIN "user" u ON u.id = sr.seller_user_id
      GROUP BY sr.seller_user_id, u.name, u.image
      ORDER BY avg_rating ASC
      LIMIT ${opts.limit} OFFSET ${offset}
    `),
    QUERY_TIMEOUT_MS,
    "seller-ratings-list"
  )

  return {
    total,
    sellers: (
      [...rows] as Array<{
        seller_user_id: string
        seller_name: string
        seller_image: string | null
        avg_rating: number
        review_count: number
        negative_mix_pct: number
      }>
    ).map((r) => ({
      sellerUserId: r.seller_user_id,
      sellerName: r.seller_name,
      sellerImage: r.seller_image,
      avgRating: Number(r.avg_rating),
      reviewCount: r.review_count,
      negativeMixPct: r.negative_mix_pct,
    })),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:unit -- reputation-sellers`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/reviews/db/reputation-sellers.ts tests/unit/reputation-sellers.test.ts
git commit -m "Add getSellerRatings — every rated seller, independent of the case engine"
```

---

### Task 10: Seller ratings page + table component

**Preconditions:** Task 9 complete.

**Files:**
- Create: `features/reviews/components/SellerRatingsTable.tsx`
- Modify: `app/admin/reviews/sellers/page.tsx`
- Test: `tests/component/seller-ratings-table.test.tsx`

**Interfaces:**
- Consumes: `getSellerRatings`, `type SellerRatingRow` (Task 9); `ListViewCard`, `ColumnDef`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/component/seller-ratings-table.test.tsx
import { describe, expect, it, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { SellerRatingsTable } from "@/features/reviews/components/SellerRatingsTable"
import type { SellerRatingRow } from "@/features/reviews/db/reputation-sellers"

afterEach(() => cleanup())

const ROW: SellerRatingRow = {
  sellerUserId: "seller-1",
  sellerName: "Pyin Oo Lwin Stones",
  sellerImage: null,
  avgRating: 4.5,
  reviewCount: 12,
  negativeMixPct: 8,
}

describe("SellerRatingsTable", () => {
  it("renders every seller's rating stats", () => {
    render(<SellerRatingsTable sellers={[ROW]} page={1} pageSize={20} total={1} />)
    expect(screen.getByText("Pyin Oo Lwin Stones")).toBeInTheDocument()
    expect(screen.getByText("4.50")).toBeInTheDocument()
    expect(screen.getByText(/12/)).toBeInTheDocument()
  })

  it("shows the empty state when nobody has been rated yet", () => {
    render(<SellerRatingsTable sellers={[]} page={1} pageSize={20} total={0} />)
    expect(screen.getByText(/no rated sellers/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:component -- seller-ratings-table`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```tsx
// features/reviews/components/SellerRatingsTable.tsx
"use client"

import { ListViewCard } from "@/components/admin/list-view"
import type { ColumnDef } from "@/components/admin/list-view"
import type { SellerRatingRow } from "@/features/reviews/db/reputation-sellers"

function buildPageHref(page: number): string {
  const p = new URLSearchParams()
  p.set("page", String(page))
  return `/admin/reviews/sellers?${p.toString()}`
}

type Row = SellerRatingRow & { id: string }

type Props = {
  sellers: SellerRatingRow[]
  page: number
  pageSize: number
  total: number
}

export function SellerRatingsTable({ sellers, page, pageSize, total }: Props) {
  const rows: Row[] = sellers.map((s) => ({ ...s, id: s.sellerUserId }))

  const columnDefs: ColumnDef<Row>[] = [
    {
      id: "seller",
      label: "Seller",
      flex: true,
      render: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="lv-avatar">{r.sellerName.slice(0, 2).toUpperCase()}</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{r.sellerName}</span>
        </div>
      ),
    },
    {
      id: "rating",
      label: "Rating",
      width: 110,
      sortable: true,
      render: (r) => <span style={{ fontWeight: 500 }}>{r.avgRating.toFixed(2)} ★</span>,
    },
    {
      id: "reviewCount",
      label: "Reviews",
      width: 110,
      sortable: true,
      render: (r) => <span>{r.reviewCount}</span>,
    },
    {
      id: "negativeMix",
      label: "Negative mix",
      width: 130,
      sortable: true,
      render: (r) => <span style={{ color: r.negativeMixPct > 20 ? "#B91C1C" : undefined }}>{r.negativeMixPct}%</span>,
    },
  ]

  return (
    <ListViewCard
      rows={rows}
      columnDefs={columnDefs}
      defaultSort={{ id: "rating", dir: "asc" }}
      getSortValue={(r, colId) => {
        switch (colId) {
          case "seller": return r.sellerName
          case "rating": return r.avgRating
          case "reviewCount": return r.reviewCount
          case "negativeMix": return r.negativeMixPct
          default: return ""
        }
      }}
      page={page}
      pageSize={pageSize}
      total={total}
      buildPageHref={buildPageHref}
      emptyMessage="No rated sellers yet."
    />
  )
}
```

```tsx
// app/admin/reviews/sellers/page.tsx — full replacement
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getSellerRatings } from "@/features/reviews/db/reputation-sellers"
import { SellerRatingsTable } from "@/features/reviews/components/SellerRatingsTable"
import { withQueryTimeout } from "@/lib/query-timeout"

const QUERY_TIMEOUT_MS = 6000
const PAGE_SIZE = 20

type Props = {
  searchParams: Promise<{ page?: string }>
}

export default async function AdminReviewsSellersPage({ searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.REVIEWS)

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)

  const { sellers, total } = await withQueryTimeout(
    getSellerRatings({ page, limit: PAGE_SIZE }),
    QUERY_TIMEOUT_MS,
    "seller-ratings-page"
  )

  return (
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <span>Admin</span> <span>›</span> <span>Reviews</span> <span>›</span>{" "}
            <span className="lv-here">Seller ratings</span>
          </nav>
          <h1 className="lv-h1">Seller ratings</h1>
          <p className="lv-subhead">Every rated seller with its rating, distribution and review volume.</p>
        </div>
      </div>

      <SellerRatingsTable sellers={sellers} page={page} pageSize={PAGE_SIZE} total={total} />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:component -- seller-ratings-table`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/reviews/sellers/page.tsx features/reviews/components/SellerRatingsTable.tsx \
  tests/component/seller-ratings-table.test.tsx
git commit -m "Build the Seller ratings admin view"
```

---

### Task 11: Audit log DB layer

**Preconditions:** None.

**Files:**
- Create: `features/reviews/db/reputation-audit.ts`
- Test: `tests/unit/reputation-audit.test.ts`

**Interfaces:**
- Produces: `type AuditLogEntry`, `getAuditLog(opts: { page: number; limit: number; actionTypes?: string[]; dateFrom?: Date; dateTo?: Date }): Promise<{ entries: AuditLogEntry[]; total: number }>`
- Consumed by: Task 12

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/reputation-audit.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const captured = vi.hoisted(() => ({ queries: [] as string[] }))

vi.mock("drizzle-orm", () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      captured.queries.push([...strings].join(""))
      return { strings, values }
    },
    {
      raw: (s: string) => s,
      join: (chunks: unknown[], separator?: unknown) => ({ chunks, separator }),
    }
  ),
}))
vi.mock("@/lib/query-timeout", () => ({
  withQueryTimeout: vi.fn((p: Promise<unknown>) => p),
}))
vi.mock("@/drizzle/db", () => ({
  db: { execute: vi.fn() },
}))

import { db } from "@/drizzle/db"
import { getAuditLog } from "@/features/reviews/db/reputation-audit"

beforeEach(() => {
  vi.clearAllMocks()
  captured.queries = []
})

describe("getAuditLog", () => {
  it("returns every entry, unfiltered, reverse-chronological", async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([{ count: 1 }] as never)
      .mockResolvedValueOnce([
        {
          id: "a1", action_type: "archived", seller_user_id: "seller-1", seller_name: "Seller",
          admin_user_id: "admin-1", admin_name: "Admin", trigger_key: null, trigger_label: null,
          reason: "Below 3.8", created_at: new Date("2026-08-01"),
        },
      ] as never)

    const result = await getAuditLog({ page: 1, limit: 20 })

    expect(result.total).toBe(1)
    expect(result.entries[0]).toEqual({
      id: "a1", actionType: "archived", sellerUserId: "seller-1", sellerName: "Seller",
      adminUserId: "admin-1", adminName: "Admin", triggerKey: null, triggerLabel: null,
      reason: "Below 3.8", createdAt: new Date("2026-08-01"),
    })
  })

  it("renders a since-deleted admin and a rule-level (no seller) action correctly", async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([{ count: 1 }] as never)
      .mockResolvedValueOnce([
        {
          id: "a2", action_type: "threshold_toggled", seller_user_id: null, seller_name: null,
          admin_user_id: null, admin_name: null, trigger_key: "rating_below_archive",
          trigger_label: "Rating below archive threshold", reason: "Too noisy", created_at: new Date("2026-08-02"),
        },
      ] as never)

    const result = await getAuditLog({ page: 1, limit: 20 })

    expect(result.entries[0].sellerUserId).toBeNull()
    expect(result.entries[0].adminName).toBeNull()
    expect(result.entries[0].triggerLabel).toBe("Rating below archive threshold")
  })

  it("builds an actionType IN-list and a date-range WHERE clause when filters are given", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([{ count: 0 }] as never).mockResolvedValueOnce([] as never)

    await getAuditLog({
      page: 1,
      limit: 20,
      actionTypes: ["archived", "dismissed"],
      dateFrom: new Date("2026-08-01"),
      dateTo: new Date("2026-08-31"),
    })

    const countQuery = captured.queries[0]
    expect(countQuery).toMatch(/WHERE/)
    expect(countQuery).not.toMatch(/ANY\(/)
  })

  it("omits the WHERE clause entirely when no filters are given", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([{ count: 0 }] as never).mockResolvedValueOnce([] as never)

    await getAuditLog({ page: 1, limit: 20 })

    expect(captured.queries[0]).not.toMatch(/WHERE/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:unit -- reputation-audit`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// features/reviews/db/reputation-audit.ts
import { sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { withQueryTimeout } from "@/lib/query-timeout"

const QUERY_TIMEOUT_MS = 6000

export type AuditLogEntry = {
  id: string
  actionType: string
  sellerUserId: string | null
  sellerName: string | null
  adminUserId: string | null
  adminName: string | null
  triggerKey: string | null
  triggerLabel: string | null
  reason: string | null
  createdAt: Date
}

/**
 * Reverse-chronological, filterable audit trail. Every array-typed filter
 * (actionTypes) goes through sql.join into an IN (...) list, never
 * `= ANY(${array})` — see Global Constraints. Conditions are built into a
 * single WHERE clause via sql.join with ` AND ` as the separator, omitted
 * entirely when no filters are given.
 */
export async function getAuditLog(opts: {
  page: number
  limit: number
  actionTypes?: string[]
  dateFrom?: Date
  dateTo?: Date
}): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const conditions = []
  if (opts.actionTypes && opts.actionTypes.length > 0) {
    const list = sql.join(opts.actionTypes.map((t) => sql`${t}`), sql`, `)
    conditions.push(sql`sra.action_type IN (${list})`)
  }
  if (opts.dateFrom) conditions.push(sql`sra.created_at >= ${opts.dateFrom}`)
  if (opts.dateTo) conditions.push(sql`sra.created_at <= ${opts.dateTo}`)
  const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``

  const offset = (opts.page - 1) * opts.limit

  const totalResult = await withQueryTimeout(
    db.execute(sql`SELECT count(*)::int AS count FROM seller_reputation_action sra ${whereClause}`),
    QUERY_TIMEOUT_MS,
    "audit-log-count"
  )
  const total = ([...totalResult] as Array<{ count: number }>)[0]?.count ?? 0
  if (total === 0) return { entries: [], total: 0 }

  const rows = await withQueryTimeout(
    db.execute(sql`
      SELECT sra.id, sra.action_type, sra.seller_user_id, seller.name AS seller_name,
             sra.admin_user_id, admin.name AS admin_name,
             sra.trigger_key, rt.label AS trigger_label,
             sra.reason, sra.created_at
      FROM seller_reputation_action sra
      LEFT JOIN "user" seller ON seller.id = sra.seller_user_id
      LEFT JOIN "user" admin ON admin.id = sra.admin_user_id
      LEFT JOIN reputation_threshold rt ON rt.id = sra.trigger_key
      ${whereClause}
      ORDER BY sra.created_at DESC
      LIMIT ${opts.limit} OFFSET ${offset}
    `),
    QUERY_TIMEOUT_MS,
    "audit-log-list"
  )

  return {
    total,
    entries: (
      [...rows] as Array<{
        id: string
        action_type: string
        seller_user_id: string | null
        seller_name: string | null
        admin_user_id: string | null
        admin_name: string | null
        trigger_key: string | null
        trigger_label: string | null
        reason: string | null
        created_at: Date
      }>
    ).map((r) => ({
      id: r.id,
      actionType: r.action_type,
      sellerUserId: r.seller_user_id,
      sellerName: r.seller_name,
      adminUserId: r.admin_user_id,
      adminName: r.admin_name,
      triggerKey: r.trigger_key,
      triggerLabel: r.trigger_label,
      reason: r.reason,
      createdAt: r.created_at,
    })),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:unit -- reputation-audit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/reviews/db/reputation-audit.ts tests/unit/reputation-audit.test.ts
git commit -m "Add filterable audit-log query"
```

---

### Task 12: Audit log page + table component

**Preconditions:** Task 11 complete.

**Files:**
- Create: `features/reviews/components/AuditLogTable.tsx`
- Modify: `app/admin/reviews/audit/page.tsx`
- Test: `tests/component/audit-log-table.test.tsx`

**Interfaces:**
- Consumes: `getAuditLog`, `type AuditLogEntry` (Task 11); `ListViewCard`, `ColumnDef`, `FilterDef`

This task follows the existing server-driven filter pattern already used by `features/products/components/ProductsListView.tsx`: the page reads filter state from `searchParams`, builds `defaultFilters` for `ListViewCard`, and `onFilterChange` writes the new filter state back into the URL via `router.push`, which re-renders the page with the new `searchParams` — closing the loop. Read `ProductsListView.tsx`'s `onFilterChange` handler once before writing this file if anything below is unclear; the shapes below match it exactly.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/component/audit-log-table.test.tsx
import { describe, expect, it, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { AuditLogTable } from "@/features/reviews/components/AuditLogTable"
import type { AuditLogEntry } from "@/features/reviews/db/reputation-audit"

afterEach(() => cleanup())

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const ENTRY: AuditLogEntry = {
  id: "a1",
  actionType: "archived",
  sellerUserId: "seller-1",
  sellerName: "Pyin Oo Lwin Stones",
  adminUserId: "admin-1",
  adminName: "Admin One",
  triggerKey: null,
  triggerLabel: null,
  reason: "Below 3.8 for 6 days",
  createdAt: new Date("2026-08-01T00:00:00Z"),
}

describe("AuditLogTable", () => {
  it("renders an entry's action type, seller, admin, and reason", () => {
    render(
      <AuditLogTable
        entries={[ENTRY]}
        page={1}
        pageSize={20}
        total={1}
        actionTypes={[]}
        dateFrom={undefined}
        dateTo={undefined}
      />
    )
    expect(screen.getByText("Pyin Oo Lwin Stones")).toBeInTheDocument()
    expect(screen.getByText("Admin One")).toBeInTheDocument()
    expect(screen.getByText("Below 3.8 for 6 days")).toBeInTheDocument()
    expect(screen.getByText(/archived/i)).toBeInTheDocument()
  })

  it("renders a rule-level entry (no seller) using the trigger label instead", () => {
    render(
      <AuditLogTable
        entries={[{ ...ENTRY, actionType: "threshold_toggled", sellerUserId: null, sellerName: null, triggerKey: "rating_below_archive", triggerLabel: "Rating below archive threshold" }]}
        page={1}
        pageSize={20}
        total={1}
        actionTypes={[]}
        dateFrom={undefined}
        dateTo={undefined}
      />
    )
    expect(screen.getByText("Rating below archive threshold")).toBeInTheDocument()
  })

  it("shows a since-deleted-admin fallback when adminName is null but adminUserId existed", () => {
    render(
      <AuditLogTable
        entries={[{ ...ENTRY, adminUserId: "admin-1", adminName: null }]}
        page={1}
        pageSize={20}
        total={1}
        actionTypes={[]}
        dateFrom={undefined}
        dateTo={undefined}
      />
    )
    expect(screen.getByText(/since-deleted admin/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:component -- audit-log-table`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```tsx
// features/reviews/components/AuditLogTable.tsx
"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ListViewCard } from "@/components/admin/list-view"
import type { ColumnDef, FilterDef } from "@/components/admin/list-view"
import type { AuditLogEntry } from "@/features/reviews/db/reputation-audit"

const ACTION_TYPE_OPTIONS = [
  { value: "archived", label: "Archived" },
  { value: "restored", label: "Restored" },
  { value: "dismissed", label: "Dismissed" },
  { value: "warned", label: "Warned" },
  { value: "limited_orders", label: "Limited orders" },
  { value: "listings_hidden", label: "Listings hidden" },
  { value: "documents_requested", label: "Documents requested" },
  { value: "escalated", label: "Escalated" },
  { value: "threshold_toggled", label: "Threshold toggled" },
]

function buildPageHref(page: number, params: URLSearchParams): string {
  const p = new URLSearchParams(params.toString())
  p.set("page", String(page))
  return `/admin/reviews/audit?${p.toString()}`
}

type Row = AuditLogEntry & { id: string }

type Props = {
  entries: AuditLogEntry[]
  page: number
  pageSize: number
  total: number
  actionTypes: string[]
  dateFrom: string | undefined
  dateTo: string | undefined
}

export function AuditLogTable({ entries, page, pageSize, total, actionTypes, dateFrom, dateTo }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const rows: Row[] = entries.map((e) => ({ ...e, id: e.id }))

  const filterDefs: FilterDef[] = [
    { id: "actionType", label: "Action", type: "multi", options: ACTION_TYPE_OPTIONS },
    { id: "createdAt", label: "Date", type: "daterange" },
  ]

  const defaultFilters: Record<string, string[]> = {
    ...(actionTypes.length > 0 ? { actionType: actionTypes } : {}),
    ...(dateFrom || dateTo
      ? { createdAt: [...(dateFrom ? [`from:${dateFrom}`] : []), ...(dateTo ? [`to:${dateTo}`] : [])] }
      : {}),
  }

  const columnDefs: ColumnDef<Row>[] = [
    {
      id: "action",
      label: "Action & who",
      flex: true,
      render: (r) => (
        <div>
          <span className="lv-status">{r.actionType.replace(/_/g, " ")}</span>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {r.sellerName ?? r.triggerLabel ?? "—"}
          </div>
          {r.reason && (
            <div style={{ fontSize: 12.5, color: "#52525B", marginTop: 2 }}>{r.reason}</div>
          )}
        </div>
      ),
    },
    {
      id: "admin",
      label: "Admin",
      width: 160,
      render: (r) => <span>{r.adminUserId ? r.adminName ?? "a since-deleted admin" : "—"}</span>,
    },
    {
      id: "createdAt",
      label: "When",
      width: 160,
      render: (r) => <span>{new Date(r.createdAt).toLocaleString()}</span>,
    },
  ]

  return (
    <ListViewCard
      rows={rows}
      columnDefs={columnDefs}
      filterDefs={filterDefs}
      defaultFilters={defaultFilters}
      onFilterChange={(changes) => {
        const params = new URLSearchParams(searchParams.toString())
        let handledAny = false
        for (const { id: filterId, values } of changes) {
          if (filterId === "actionType") {
            if (values.length > 0) params.set("actionType", values.join(","))
            else params.delete("actionType")
            handledAny = true
          }
          if (filterId === "createdAt") {
            const from = values.find((v) => v.startsWith("from:"))?.slice(5)
            const to = values.find((v) => v.startsWith("to:"))?.slice(3)
            if (from) params.set("from", from)
            else params.delete("from")
            if (to) params.set("to", to)
            else params.delete("to")
            handledAny = true
          }
        }
        if (handledAny) {
          params.set("page", "1")
          router.push(`/admin/reviews/audit?${params.toString()}`)
          return true
        }
      }}
      page={page}
      pageSize={pageSize}
      total={total}
      buildPageHref={(p) => buildPageHref(p, searchParams)}
      emptyMessage="No audit entries yet."
    />
  )
}
```

```tsx
// app/admin/reviews/audit/page.tsx — full replacement
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getAuditLog } from "@/features/reviews/db/reputation-audit"
import { AuditLogTable } from "@/features/reviews/components/AuditLogTable"
import { withQueryTimeout } from "@/lib/query-timeout"

const QUERY_TIMEOUT_MS = 6000
const PAGE_SIZE = 20

type Props = {
  searchParams: Promise<{ page?: string; actionType?: string; from?: string; to?: string }>
}

export default async function AdminReviewsAuditPage({ searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.REVIEWS)

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const actionTypes = params.actionType ? params.actionType.split(",").filter(Boolean) : []
  const dateFrom = params.from ? new Date(`${params.from}T00:00:00`) : undefined
  const dateTo = params.to ? new Date(`${params.to}T23:59:59`) : undefined

  const { entries, total } = await withQueryTimeout(
    getAuditLog({ page, limit: PAGE_SIZE, actionTypes, dateFrom, dateTo }),
    QUERY_TIMEOUT_MS,
    "audit-log-page"
  )

  return (
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <span>Admin</span> <span>›</span> <span>Reviews</span> <span>›</span>{" "}
            <span className="lv-here">Audit log</span>
          </nav>
          <h1 className="lv-h1">Audit log</h1>
          <p className="lv-subhead">
            Every archive, restore, warning and threshold change, with the admin who made it.
          </p>
        </div>
      </div>

      <AuditLogTable
        entries={entries}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        actionTypes={actionTypes}
        dateFrom={params.from}
        dateTo={params.to}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test:component -- audit-log-table`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/reviews/audit/page.tsx features/reviews/components/AuditLogTable.tsx \
  tests/component/audit-log-table.test.tsx
git commit -m "Build the Audit log admin view with action-type and date-range filters"
```

---

### Task 13: Docs + full verification

**Preconditions:** Tasks 1–12 complete.

**Files:**
- Modify: `docs/technical/reviews-admin-phase1.md` → rename content additions into a new "Phase 2" section (do not create a second technical doc — phase 2 is additive to the same feature)
- Modify: `docs/guides/reviews-admin.md`

- [ ] **Step 1: Write the technical doc addition**

Append a "## Phase 2" section to `docs/technical/reviews-admin-phase1.md` covering: what changed (5 new views, 2 new mutations, file list); data flow for each new DB function; the admin-only bar for `toggleThreshold` and why (link back to the design spec's rationale, don't duplicate it); the `archiveSeller` upsert fix (now nulls `restoredByAdminId` too); and a known-limitations addendum noting the Overview KPIs and Seller ratings list are both independent of `computeCaseSummaries()` by design (see design spec).

- [ ] **Step 2: Write the collaborator guide addition**

Append to `docs/guides/reviews-admin.md`: how to reach each of the 5 new pages; how Restore differs from re-archiving (guarded update vs. upsert); how the Thresholds toggle's admin-only gate works and how to test it locally (log in as a `role: "internal"` user with the Reviews permission — the page renders, the toggle control does not); how to add a new audit-log filter (extend `ACTION_TYPE_OPTIONS` in `AuditLogTable.tsx` and the corresponding `getAuditLog` WHERE-builder in `reputation-audit.ts`).

- [ ] **Step 3: Run the full test suite**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run test`
Expected: all tests pass, including every new one from Tasks 1–12. The only acceptable failures are the pre-existing, unrelated ones already confirmed on this repo's `main` before phase 2 started (`tests/unit/resolve-adjacent-products.test.ts`, `tests/api/products/id-route.test.ts`) — verify via `git stash` that any failure you see also occurs without this branch's changes before treating it as acceptable; any other failure must be fixed.

- [ ] **Step 4: Run lint**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual verification in a real browser, with real data**

Using the browser-testing-with-devtools skill (Chrome DevTools MCP): start the dev server, log in as `admin@gemx.com`, and for each of the 5 new pages confirm it renders with no console errors:
- `/admin/reviews` — KPI tiles show real numbers, recent activity lists real rows once any exist.
- `/admin/reviews/sellers` — every seller with at least one rating appears.
- `/admin/reviews/archived` — archive a seller from Reputation Cases first if none is archived yet, confirm it appears here, then Restore it and confirm the row disappears and the seller re-qualifies as an open case on next Reputation Cases load.
- `/admin/reviews/thresholds` — as an admin, toggle a rule off and back on, confirming the audit log records both; then check as an internal-role user with the Reviews permission that the toggle control does not render.
- `/admin/reviews/audit` — confirms every action taken during this verification pass shows up, and that filtering by action type and by date range narrows the list correctly.

Phase 1's whole-branch review found a bug (`= ANY(${array})` array binding) that survived every mocked test and only surfaced with real seeded data — do not skip this step or treat mocked-test-green as sufficient. If the local dev DB has no seed data for a given view, seed a few rows temporarily (matching the approach phase 1's controller used: a handful of `seller_rating` rows for a test seller), verify, then clean the temporary rows up afterward — do not leave synthetic data behind.

- [ ] **Step 6: Commit**

```bash
git add docs/technical/reviews-admin-phase1.md docs/guides/reviews-admin.md
git commit -m "Add phase-2 docs and confirm full-suite + live-DB verification"
```
