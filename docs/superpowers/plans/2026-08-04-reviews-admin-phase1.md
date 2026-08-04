# Reviews & Seller Reputation — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the shared data model, RBAC/sidebar scaffold, and a fully working **Reputation Cases** admin view (`/admin/reviews/cases`) — the primary working surface of the new Reviews & Seller Reputation admin area. The other five views (Overview, Seller ratings, Archived sellers, Case thresholds, Audit log) get placeholder routes only, to be designed and built in later phases.

**Architecture:** Three new Drizzle tables (`reputation_threshold`, `seller_reputation_action`, `seller_archive`) back a *live-computed* case engine — there is no persisted "open case" row. `features/reviews/db/reputation-cases.ts` queries `seller_rating` (+ tag joins) against 4 computable threshold rules on every request, merges per-seller signals, and excludes archived/dismissed sellers. Mutations (archive, dismiss, secondary actions) write to the two audit/state tables via Next.js server actions. The Reputation Cases page reuses the existing `ListViewCard` table system exactly as the Credit Purchase Requests page does.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (postgres-js), Better Auth, Zod, Vitest, sonner (toasts), existing `components/admin/list-view/ListViewCard`.

**Design spec:** `docs/superpowers/specs/2026-08-04-reviews-admin-phase1-design.md` — read it for the full rationale (why live-computed, why 3 tables, which threshold rules are real vs. inert, what's explicitly out of scope). This plan implements that spec; do not re-litigate decisions already made there.

## Global Constraints

- **Never run `npm run db:generate`, `npm run db:migrate`, or `npm run db:push`.** The user applies all migrations manually. Task 1 ends with schema files written and a STOP instruction — do not proceed past it until the user confirms the migration has been applied.
- **Never use `Promise.all()` for concurrent DB queries in a server component or route handler.** This codebase suffered a real Supabase connection-pool exhaustion incident (`docs/technical/connection-pool-hardening.md` and equivalent) from concurrent query fan-out. Run DB calls sequentially, each wrapped in `withQueryTimeout(promise, ms, label)` from `lib/query-timeout.ts` (6000ms default) or `safeAll(...)` from `lib/db-timeout.ts` for non-critical parallel reads with fallbacks.
- **Zod schemas live in `features/<feature>/schemas/`, never inline in route/action files** — existing repo convention.
- **Every admin mutation requires a reason string** for `archived` and `dismissed` action types (enforced by Zod `.min(1)`), per the design spec.
- After every task that touches `app/api/`, `features/`, or `drizzle/schema/`, run `npm run lint` and the relevant `npm run test:*` script before committing — the pre-commit hook runs full-repo lint and will block the commit otherwise (Node 22 must be active: `source ~/.nvm/nvm.sh && nvm use 22` if `npm` is not on `PATH`).
- Per this repo's CLAUDE.md, every change requires: a technical doc (`docs/technical/`), unit/API/component tests, a collaborator guide (`docs/guides/`), and — because this plan adds a route under `app/api/`— API docs (`docs/api/`). Task 11 covers all four.

---

### Task 1: Schema — reputation tables

**Files:**
- Create: `drizzle/schema/reputation-schema.ts`
- Modify: `drizzle/schema.ts`

**Interfaces:**
- Produces: `reputationActionTypeEnum`, `sellerAppealStatusEnum`, `reputationThreshold`, `sellerReputationAction`, `sellerArchive` (all Drizzle table/enum objects), importable from `@/drizzle/schema/reputation-schema`.

- [ ] **Step 1: Write the schema file**

```ts
// drizzle/schema/reputation-schema.ts
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "./auth-schema"

export const reputationActionTypeEnum = pgEnum("reputation_action_type", [
  "archived",
  "restored",
  "dismissed",
  "warned",
  "limited_orders",
  "listings_hidden",
  "documents_requested",
  "escalated",
  "threshold_toggled",
])

export const sellerAppealStatusEnum = pgEnum("seller_appeal_status", [
  "none",
  "under_review",
  "rejected",
  "upheld_restored",
])

/**
 * Config for the 6 rules that open a reputation case. Rows are seeded
 * idempotently at read time (see ensureThresholdsSeeded in
 * features/reviews/db/reputation-thresholds.ts) rather than via migration —
 * migrations in this repo only ever create the empty table.
 */
export const reputationThreshold = pgTable("reputation_threshold", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  logicDescription: text("logic_description").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  sortOrder: integer("sort_order").notNull(),
  dataAvailable: boolean("data_available").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

/**
 * Append-only audit trail for every reputation-case decision. Doubles as
 * the Audit log view's data source (later phase) and as the suppression
 * record that keeps a dismissed case from reopening off stale data (see
 * getOpenReputationCases in features/reviews/db/reputation-cases.ts).
 */
export const sellerReputationAction = pgTable(
  "seller_reputation_action",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Null only for a future threshold_toggled action, which targets a rule, not a seller.
    sellerUserId: text("seller_user_id").references(() => user.id, { onDelete: "cascade" }),
    actionType: reputationActionTypeEnum("action_type").notNull(),
    triggerKey: text("trigger_key").references(() => reputationThreshold.id, { onDelete: "set null" }),
    reason: text("reason"),
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("seller_reputation_action_seller_user_id_idx").on(table.sellerUserId),
    index("seller_reputation_action_seller_trigger_idx").on(table.sellerUserId, table.triggerKey),
    index("seller_reputation_action_created_at_idx").on(table.createdAt),
  ]
)

/** Current archive state — one row per seller that has ever been archived. */
export const sellerArchive = pgTable(
  "seller_archive",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sellerUserId: text("seller_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    archivedByAdminId: text("archived_by_admin_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    archivedAt: timestamp("archived_at").defaultNow().notNull(),
    // Admin-set only — no buyer-facing appeal intake exists (see design spec non-goals).
    appealStatus: sellerAppealStatusEnum("appeal_status").default("none").notNull(),
    restoredAt: timestamp("restored_at"),
    restoredByAdminId: text("restored_by_admin_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("seller_archive_seller_user_id_unique").on(table.sellerUserId),
    index("seller_archive_restored_at_idx").on(table.restoredAt),
  ]
)
```

- [ ] **Step 2: Export it from the schema barrel**

Add one line to `drizzle/schema.ts`, following the file's existing pattern (append after the last line):

```ts
export * from "./schema/reputation-schema"
```

- [ ] **Step 3: Confirm the file compiles**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `reputation-schema.ts` or `schema.ts`.

- [ ] **Step 4: STOP — hand off to the user for migration**

Do not run `npm run db:generate` or `npm run db:migrate` yourself. Tell the user:

> "Schema changes for `reputation_threshold`, `seller_reputation_action`, and `seller_archive` are written to `drizzle/schema/reputation-schema.ts`. Please run `npm run db:generate` then `npm run db:migrate` locally, and let me know once that's done so I can continue."

Do not proceed to Task 3 or later (which query these tables) until the user confirms the migration ran. Task 2 (RBAC keys) has no DB dependency and can proceed immediately.

- [ ] **Step 5: Commit**

```bash
git add drizzle/schema/reputation-schema.ts drizzle/schema.ts
git commit -m "Add reputation_threshold, seller_reputation_action, seller_archive schema"
```

---

### Task 2: RBAC — FEATURE_KEYS.REVIEWS

**Files:**
- Modify: `features/rbac/feature-keys.ts`
- Test: `tests/unit/reviews-feature-keys.test.ts`

**Interfaces:**
- Produces: `FEATURE_KEYS.REVIEWS` (string literal `"reviews"`), a new `FEATURE_GROUPS` entry labeled `"Trust & Reputation"`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/reviews-feature-keys.test.ts
import { describe, expect, it } from "vitest"
import { FEATURE_KEYS, FEATURE_GROUPS } from "@/features/rbac/feature-keys"

describe("FEATURE_KEYS.REVIEWS", () => {
  it("is defined as 'reviews'", () => {
    expect(FEATURE_KEYS.REVIEWS).toBe("reviews")
  })

  it("appears exactly once across all FEATURE_GROUPS", () => {
    const allKeys = FEATURE_GROUPS.flatMap((g) => g.features.map((f) => f.key))
    const matches = allKeys.filter((k) => k === FEATURE_KEYS.REVIEWS)
    expect(matches).toHaveLength(1)
  })

  it("is placed under the Trust & Reputation group", () => {
    const group = FEATURE_GROUPS.find((g) =>
      g.features.some((f) => f.key === FEATURE_KEYS.REVIEWS)
    )
    expect(group?.label).toBe("Trust & Reputation")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- reviews-feature-keys`
Expected: FAIL — `FEATURE_KEYS.REVIEWS` is `undefined`.

- [ ] **Step 3: Add the key and group**

In `features/rbac/feature-keys.ts`, add to the `FEATURE_KEYS` object (after `SETTINGS_APP_CONTENT`):

```ts
  SETTINGS_APP_CONTENT:      "settings.app_content",
  REVIEWS:                   "reviews",
} as const
```

Add a new entry to `FEATURE_GROUPS` (after the `"Settings"` group):

```ts
  {
    label: "Trust & Reputation",
    features: [
      { key: FEATURE_KEYS.REVIEWS, label: "Reviews & Seller Reputation" },
    ],
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- reviews-feature-keys`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/rbac/feature-keys.ts tests/unit/reviews-feature-keys.test.ts
git commit -m "Add FEATURE_KEYS.REVIEWS for the Reviews admin area"
```

---

### Task 3: Threshold config DB layer

**Preconditions:** Task 1's migration must be applied (confirm with the user before starting).

**Files:**
- Create: `features/reviews/db/reputation-thresholds.ts`
- Test: `tests/unit/reputation-thresholds.test.ts`

**Interfaces:**
- Produces: `type ThresholdId`, `type ThresholdRow`, `ensureThresholdsSeeded(): Promise<void>`, `getThresholds(): Promise<ThresholdRow[]>`, `getEnabledThresholdIds(): Promise<Set<ThresholdId>>`.
- Consumed by: Task 4 (case computation needs `getEnabledThresholdIds()`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/reputation-thresholds.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => "eq"),
}))

vi.mock("@/drizzle/schema/reputation-schema", () => ({
  reputationThreshold: {
    id: "id",
    label: "label",
    logicDescription: "logic_description",
    enabled: "enabled",
    sortOrder: "sort_order",
    dataAvailable: "data_available",
  },
}))

vi.mock("@/drizzle/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}))

import { db } from "@/drizzle/db"
import {
  ensureThresholdsSeeded,
  getThresholds,
  getEnabledThresholdIds,
} from "@/features/reviews/db/reputation-thresholds"

describe("ensureThresholdsSeeded", () => {
  beforeEach(() => vi.clearAllMocks())

  it("inserts the 6 default rules with onConflictDoNothing", async () => {
    const onConflictDoNothingMock = vi.fn().mockResolvedValue(undefined)
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock })
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as never)

    await ensureThresholdsSeeded()

    expect(db.insert).toHaveBeenCalledTimes(1)
    const inserted = valuesMock.mock.calls[0][0] as Array<{ id: string }>
    expect(inserted).toHaveLength(6)
    expect(inserted.map((r) => r.id)).toEqual([
      "rating_below_archive",
      "negative_streak",
      "tag_concentration",
      "non_delivery_reports",
      "positive_burst",
      "auto_archive",
    ])
    expect(onConflictDoNothingMock).toHaveBeenCalledWith({ target: "id" })
  })
})

describe("getThresholds", () => {
  beforeEach(() => vi.clearAllMocks())

  it("seeds then returns rows ordered by sortOrder", async () => {
    const onConflictDoNothingMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock }),
    } as never)

    const rows = [
      { id: "rating_below_archive", enabled: true, dataAvailable: true, sortOrder: 1, label: "x", logicDescription: "y" },
      { id: "non_delivery_reports", enabled: false, dataAvailable: false, sortOrder: 4, label: "x", logicDescription: "y" },
    ]
    const orderByMock = vi.fn().mockResolvedValue(rows)
    const fromMock = vi.fn().mockReturnValue({ orderBy: orderByMock })
    vi.mocked(db.select).mockReturnValue({ from: fromMock } as never)

    const result = await getThresholds()

    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(result).toEqual(rows)
  })
})

describe("getEnabledThresholdIds", () => {
  beforeEach(() => vi.clearAllMocks())

  it("excludes rules that are disabled or lack data", async () => {
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }),
    } as never)
    const rows = [
      { id: "rating_below_archive", enabled: true, dataAvailable: true, sortOrder: 1, label: "x", logicDescription: "y" },
      { id: "non_delivery_reports", enabled: false, dataAvailable: false, sortOrder: 4, label: "x", logicDescription: "y" },
      { id: "auto_archive", enabled: false, dataAvailable: true, sortOrder: 6, label: "x", logicDescription: "y" },
    ]
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(rows) }),
    } as never)

    const ids = await getEnabledThresholdIds()

    expect(ids.has("rating_below_archive")).toBe(true)
    expect(ids.has("non_delivery_reports")).toBe(false)
    expect(ids.has("auto_archive")).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- reputation-thresholds`
Expected: FAIL — module `@/features/reviews/db/reputation-thresholds` does not exist.

- [ ] **Step 3: Implement**

```ts
// features/reviews/db/reputation-thresholds.ts
import { eq } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { reputationThreshold } from "@/drizzle/schema/reputation-schema"

export type ThresholdId =
  | "rating_below_archive"
  | "negative_streak"
  | "tag_concentration"
  | "non_delivery_reports"
  | "positive_burst"
  | "auto_archive"

export type ThresholdRow = {
  id: ThresholdId
  label: string
  logicDescription: string
  enabled: boolean
  sortOrder: number
  dataAvailable: boolean
}

const DEFAULT_THRESHOLDS: ThresholdRow[] = [
  {
    id: "rating_below_archive",
    label: "Rating below archive threshold",
    logicDescription: "Rating < 3.80 with ≥ 30 reviews",
    enabled: true,
    sortOrder: 1,
    dataAvailable: true,
  },
  {
    id: "negative_streak",
    label: "Negative review streak",
    logicDescription: "7 of the last 10 buyer reviews are 1–2★",
    enabled: true,
    sortOrder: 2,
    dataAvailable: true,
  },
  {
    id: "tag_concentration",
    label: "Bad Communication concentration",
    logicDescription: "Tag on > 25% of reviews in 30 days",
    enabled: true,
    sortOrder: 3,
    dataAvailable: true,
  },
  {
    id: "non_delivery_reports",
    label: "Non-delivery reports",
    // No buyer-report/dispute mechanism exists anywhere in this schema — see design spec.
    logicDescription: "≥ 3 buyers report no shipment after escrow funding in 30 days",
    enabled: false,
    sortOrder: 4,
    dataAvailable: false,
  },
  {
    id: "positive_burst",
    label: "Suspicious positive burst",
    logicDescription: "> 20 reviews in 24h at 3× baseline (volume only — device clustering not available)",
    enabled: true,
    sortOrder: 5,
    dataAvailable: true,
  },
  {
    id: "auto_archive",
    label: "Auto-archive on threshold breach",
    // Toggling this on has no automatic runtime effect yet — no scheduler exists (see design spec).
    logicDescription: "Archive without an admin decision when rating < 3.50 for 30 days",
    enabled: false,
    sortOrder: 6,
    dataAvailable: true,
  },
]

/** Idempotent — inserts the 6 default rules if missing. Safe to call on every read. */
export async function ensureThresholdsSeeded(): Promise<void> {
  await db
    .insert(reputationThreshold)
    .values(DEFAULT_THRESHOLDS)
    .onConflictDoNothing({ target: reputationThreshold.id })
}

export async function getThresholds(): Promise<ThresholdRow[]> {
  await ensureThresholdsSeeded()
  const rows = await db
    .select()
    .from(reputationThreshold)
    .orderBy(reputationThreshold.sortOrder)
  return rows as ThresholdRow[]
}

export async function getEnabledThresholdIds(): Promise<Set<ThresholdId>> {
  const rows = await getThresholds()
  return new Set(rows.filter((r) => r.enabled && r.dataAvailable).map((r) => r.id))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- reputation-thresholds`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/reviews/db/reputation-thresholds.ts tests/unit/reputation-thresholds.test.ts
git commit -m "Add reputation threshold config DB layer with idempotent seeding"
```

---

### Task 4: Case computation DB layer

**Preconditions:** Task 1's migration applied. Task 3 complete.

**Files:**
- Create: `features/reviews/db/reputation-cases.ts`
- Test: `tests/unit/reputation-cases.test.ts`

**Interfaces:**
- Consumes: `getEnabledThresholdIds()`, `type ThresholdId` from `features/reviews/db/reputation-thresholds.ts`.
- Produces: `type Severity`, `type ReputationSignal`, `type ReputationCase`, `type ReputationCaseTab`, `getOpenReputationCases(opts): Promise<{ cases: ReputationCase[]; total: number }>`, `getReputationCaseCounts(): Promise<{ all: number; critical: number; buyerReports: number; closed: number }>`, `getReputationBadgeCounts(): Promise<{ openCases: number; archivedSellers: number }>`.
- Consumed by: Task 7 (server actions reference `ThresholdId`), Task 10 (page.tsx and table component).

This is the most involved file in the plan. Build it in three passes so each has an independent test cycle: (a) the four rule-matcher queries, (b) the merge/suppression logic that turns rule matches into `CaseSummary[]`, (c) the public `getOpenReputationCases` / counts functions that hydrate a page of results.

- [ ] **Step 1: Write the failing test for the rule matchers**

```ts
// tests/unit/reputation-cases.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("drizzle-orm", () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    { raw: (s: string) => s }
  ),
  eq: vi.fn(() => "eq"),
  inArray: vi.fn(() => "inArray"),
  desc: vi.fn((x: unknown) => x),
}))

vi.mock("@/drizzle/schema/auth-schema", () => ({
  user: { id: "id", name: "name", image: "image", premiumDealerExpiresAt: "premium_dealer_expires_at" },
}))
vi.mock("@/drizzle/schema/seller-rating-schema", () => ({
  sellerRating: {
    id: "id", raterUserId: "rater_user_id", sellerUserId: "seller_user_id",
    score: "score", comment: "comment", createdAt: "created_at",
  },
}))
vi.mock("@/drizzle/schema/rating-tag-schema", () => ({
  ratingTag: { id: "id", name: "name", type: "type" },
}))
vi.mock("@/drizzle/schema/rating-tag-map-schema", () => ({
  ratingTagMap: { id: "id", ratingId: "rating_id", tagId: "tag_id" },
}))
vi.mock("@/drizzle/schema/reputation-schema", () => ({
  sellerReputationAction: {
    id: "id", sellerUserId: "seller_user_id", actionType: "action_type",
    triggerKey: "trigger_key", reason: "reason", adminUserId: "admin_user_id", createdAt: "created_at",
  },
  sellerArchive: { id: "id", sellerUserId: "seller_user_id", restoredAt: "restored_at" },
}))
vi.mock("@/drizzle/schema/product-schema", () => ({
  product: { id: "id", sellerId: "seller_id", status: "status" },
}))
vi.mock("@/features/reviews/db/reputation-thresholds", () => ({
  getEnabledThresholdIds: vi.fn().mockResolvedValue(
    new Set(["rating_below_archive", "negative_streak", "tag_concentration", "positive_burst"])
  ),
}))
vi.mock("@/lib/query-timeout", () => ({
  withQueryTimeout: vi.fn((p: Promise<unknown>) => p),
}))
vi.mock("@/drizzle/db", () => ({
  db: { select: vi.fn(), execute: vi.fn() },
}))

import { db } from "@/drizzle/db"
import { getOpenReputationCases, getReputationCaseCounts } from "@/features/reviews/db/reputation-cases"

function mockGroupByHaving(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      groupBy: vi.fn().mockReturnValue({
        having: vi.fn().mockResolvedValue(rows),
      }),
    }),
  }
}

describe("getOpenReputationCases", () => {
  beforeEach(() => vi.clearAllMocks())

  it("flags a seller below the rating floor and excludes archived sellers", async () => {
    // Rule 1 (rating_below_archive): one seller matches
    vi.mocked(db.select).mockReturnValueOnce(
      mockGroupByHaving([
        { sellerUserId: "seller-1", avgScore: 3.5, reviewCount: 40, maxReviewCreatedAt: new Date("2026-08-01") },
      ]) as never
    )
    // Rule 2/3/5 use db.execute (raw SQL) — return empty for this test
    vi.mocked(db.execute).mockResolvedValue([] as never)
    // Dismissal lookup (db.select) — none
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    } as never)
    // Archived sellers lookup — seller-2 archived
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ sellerUserId: "seller-2" }]) }),
    } as never)
    // Page hydration: user lookup
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([
        { id: "seller-1", name: "Pyin Oo Lwin Stones", image: null, premiumDealerExpiresAt: null },
      ]) }),
    } as never)
    // Page hydration: per-seller rating aggregates (avgAll/avgBefore30d/negativeCount)
    vi.mocked(db.execute).mockResolvedValueOnce([
      { seller_user_id: "seller-1", avg_all: 3.5, avg_before_30d: 3.9, negative_count: 12, review_count: 40 },
    ] as never)
    // Page hydration: recent reviews
    vi.mocked(db.execute).mockResolvedValueOnce([] as never)
    // Page hydration: active listings count
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ sellerUserId: "seller-1", count: 12 }]) }),
    } as never)
    // Page hydration: prior warnings count
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    } as never)

    const result = await getOpenReputationCases({ tab: "all", page: 1, limit: 20 })

    expect(result.total).toBe(1)
    expect(result.cases).toHaveLength(1)
    expect(result.cases[0].sellerUserId).toBe("seller-1")
    expect(result.cases[0].severity).toBe("critical")
  })
})

describe("getReputationCaseCounts", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns zero counts when nothing matches any rule", async () => {
    vi.mocked(db.select).mockReturnValue(mockGroupByHaving([]) as never)
    vi.mocked(db.execute).mockResolvedValue([] as never)

    const counts = await getReputationCaseCounts()

    expect(counts.all).toBe(0)
    expect(counts.critical).toBe(0)
    expect(counts.buyerReports).toBe(0)
    expect(counts.closed).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- reputation-cases`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// features/reviews/db/reputation-cases.ts
import { eq, inArray, sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { sellerRating } from "@/drizzle/schema/seller-rating-schema"
import { ratingTag } from "@/drizzle/schema/rating-tag-schema"
import { ratingTagMap } from "@/drizzle/schema/rating-tag-map-schema"
import { sellerReputationAction, sellerArchive } from "@/drizzle/schema/reputation-schema"
import { product } from "@/drizzle/schema/product-schema"
import { withQueryTimeout } from "@/lib/query-timeout"
import { getEnabledThresholdIds, type ThresholdId } from "./reputation-thresholds"

const QUERY_TIMEOUT_MS = 6000

export type Severity = "critical" | "high" | "medium" | "watch"

export type ReputationSignal = {
  triggerKey: ThresholdId
  label: string
  detail: string
  severity: Severity
}

export type ReputationCaseTab = "all" | "critical" | "buyer_reports" | "closed"

export type ReputationCase = {
  id: string
  sellerUserId: string
  sellerName: string
  sellerImage: string | null
  isPremium: boolean
  avgRating: number
  reviewCount: number
  ratingChange30d: number
  negativeMixPct: number
  signals: ReputationSignal[]
  severity: Severity
  openSince: Date
  recentReviews: Array<{
    id: string
    buyerName: string
    score: number
    comment: string | null
    tags: string[]
    createdAt: Date
  }>
  activeListingsCount: number
  priorWarningsCount: number
}

type CaseSummary = {
  sellerUserId: string
  signals: ReputationSignal[]
  severity: Severity
  openSince: Date
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 3, high: 2, medium: 1, watch: 0 }

const RULE_SEVERITY: Record<string, Severity> = {
  rating_below_archive: "critical",
  negative_streak: "high",
  tag_concentration: "medium",
  positive_burst: "high",
}

type RuleMatch = { sellerUserId: string; detail: string; maxReviewCreatedAt: Date }

async function matchRatingBelowArchive(): Promise<RuleMatch[]> {
  const rows = await withQueryTimeout(
    db
      .select({
        sellerUserId: sellerRating.sellerUserId,
        avgScore: sql<number>`avg(${sellerRating.score})`,
        reviewCount: sql<number>`count(*)::int`,
        maxReviewCreatedAt: sql<Date>`max(${sellerRating.createdAt})`,
      })
      .from(sellerRating)
      .groupBy(sellerRating.sellerUserId)
      .having(sql`avg(${sellerRating.score}) < 3.80 AND count(*) >= 30`),
    QUERY_TIMEOUT_MS,
    "reputation-rule-rating-below-archive"
  )
  return rows.map((r) => ({
    sellerUserId: r.sellerUserId,
    detail: `${Number(r.avgScore).toFixed(2)} avg over ${r.reviewCount} reviews (floor 3.80)`,
    maxReviewCreatedAt: new Date(r.maxReviewCreatedAt),
  }))
}

async function matchNegativeStreak(): Promise<RuleMatch[]> {
  const result = await withQueryTimeout(
    db.execute(sql`
      SELECT seller_user_id,
             count(*) FILTER (WHERE score <= 2)::int AS negative_count,
             max(created_at) AS max_created_at
      FROM (
        SELECT seller_user_id, score, created_at,
               row_number() OVER (PARTITION BY seller_user_id ORDER BY created_at DESC) AS rn
        FROM seller_rating
      ) ranked
      WHERE rn <= 10
      GROUP BY seller_user_id
      HAVING count(*) FILTER (WHERE score <= 2) >= 7
    `),
    QUERY_TIMEOUT_MS,
    "reputation-rule-negative-streak"
  )
  const rows = [...result] as Array<{ seller_user_id: string; negative_count: number; max_created_at: Date }>
  return rows.map((r) => ({
    sellerUserId: r.seller_user_id,
    detail: `${r.negative_count} of the last 10 reviews are 1–2★`,
    maxReviewCreatedAt: new Date(r.max_created_at),
  }))
}

async function matchTagConcentration(): Promise<RuleMatch[]> {
  const result = await withQueryTimeout(
    db.execute(sql`
      SELECT sr.seller_user_id,
             count(*) FILTER (WHERE rt.name = 'Bad Communication')::int AS tagged_count,
             count(*)::int AS total_count,
             max(sr.created_at) FILTER (WHERE rt.name = 'Bad Communication') AS max_created_at
      FROM seller_rating sr
      LEFT JOIN rating_tag_map rtm ON rtm.rating_id = sr.id
      LEFT JOIN rating_tags rt ON rt.id = rtm.tag_id
      WHERE sr.created_at >= now() - interval '30 days'
      GROUP BY sr.seller_user_id
      HAVING count(*) >= 10
         AND count(*) FILTER (WHERE rt.name = 'Bad Communication')::numeric / count(*) > 0.25
    `),
    QUERY_TIMEOUT_MS,
    "reputation-rule-tag-concentration"
  )
  const rows = [...result] as Array<{
    seller_user_id: string
    tagged_count: number
    total_count: number
    max_created_at: Date | null
  }>
  return rows
    .filter((r) => r.max_created_at)
    .map((r) => ({
      sellerUserId: r.seller_user_id,
      detail: `${Math.round((r.tagged_count / r.total_count) * 100)}% of reviews in the last 30 days tagged Bad Communication`,
      maxReviewCreatedAt: new Date(r.max_created_at as Date),
    }))
}

async function matchPositiveBurst(): Promise<RuleMatch[]> {
  const result = await withQueryTimeout(
    db.execute(sql`
      SELECT seller_user_id,
             count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS count_24h,
             count(*) FILTER (WHERE created_at >= now() - interval '30 days')::numeric / 30 AS baseline_per_day,
             max(created_at) FILTER (WHERE created_at >= now() - interval '24 hours') AS max_created_at
      FROM seller_rating
      GROUP BY seller_user_id
      HAVING count(*) FILTER (WHERE created_at >= now() - interval '24 hours') > 5
         AND count(*) FILTER (WHERE created_at >= now() - interval '24 hours')
             > 3 * (count(*) FILTER (WHERE created_at >= now() - interval '30 days')::numeric / 30)
    `),
    QUERY_TIMEOUT_MS,
    "reputation-rule-positive-burst"
  )
  const rows = [...result] as Array<{
    seller_user_id: string
    count_24h: number
    baseline_per_day: number
    max_created_at: Date | null
  }>
  return rows
    .filter((r) => r.max_created_at)
    .map((r) => ({
      sellerUserId: r.seller_user_id,
      detail: `${r.count_24h} reviews in the last 24h vs a baseline of ${Number(r.baseline_per_day).toFixed(1)}/day`,
      maxReviewCreatedAt: new Date(r.max_created_at as Date),
    }))
}

const RULE_MATCHERS: Record<string, () => Promise<RuleMatch[]>> = {
  rating_below_archive: matchRatingBelowArchive,
  negative_streak: matchNegativeStreak,
  tag_concentration: matchTagConcentration,
  positive_burst: matchPositiveBurst,
}

const RULE_LABELS: Record<string, string> = {
  rating_below_archive: "Rating below archive threshold",
  negative_streak: "Negative review streak",
  tag_concentration: "Bad Communication concentration",
  positive_burst: "Suspicious positive burst",
}

/** Computes every seller's open signals, applying dismissal suppression and archive exclusion. */
async function computeCaseSummaries(): Promise<CaseSummary[]> {
  const enabledIds = await getEnabledThresholdIds()

  const matchesByRule = new Map<string, RuleMatch[]>()
  for (const ruleId of Object.keys(RULE_MATCHERS)) {
    if (!enabledIds.has(ruleId as ThresholdId)) continue
    matchesByRule.set(ruleId, await RULE_MATCHERS[ruleId]())
  }

  const dismissalRows = await withQueryTimeout(
    db
      .select({
        sellerUserId: sellerReputationAction.sellerUserId,
        triggerKey: sellerReputationAction.triggerKey,
        dismissedAt: sql<Date>`max(${sellerReputationAction.createdAt})`,
      })
      .from(sellerReputationAction)
      .where(eq(sellerReputationAction.actionType, "dismissed"))
      .groupBy(sellerReputationAction.sellerUserId, sellerReputationAction.triggerKey),
    QUERY_TIMEOUT_MS,
    "reputation-dismissals"
  )
  const dismissedAt = new Map<string, Date>()
  for (const row of dismissalRows) {
    if (row.sellerUserId && row.triggerKey) {
      dismissedAt.set(`${row.sellerUserId}:${row.triggerKey}`, new Date(row.dismissedAt))
    }
  }

  const archivedRows = await withQueryTimeout(
    db
      .select({ sellerUserId: sellerArchive.sellerUserId })
      .from(sellerArchive)
      .where(sql`${sellerArchive.restoredAt} IS NULL`),
    QUERY_TIMEOUT_MS,
    "reputation-archived-sellers"
  )
  const archivedSellerIds = new Set(archivedRows.map((r) => r.sellerUserId))

  const bySeller = new Map<string, CaseSummary>()
  for (const [ruleId, matches] of matchesByRule) {
    for (const match of matches) {
      if (archivedSellerIds.has(match.sellerUserId)) continue
      const suppressedAt = dismissedAt.get(`${match.sellerUserId}:${ruleId}`)
      if (suppressedAt && suppressedAt >= match.maxReviewCreatedAt) continue

      const severity = RULE_SEVERITY[ruleId] ?? "watch"
      const signal: ReputationSignal = {
        triggerKey: ruleId as ThresholdId,
        label: RULE_LABELS[ruleId] ?? ruleId,
        detail: match.detail,
        severity,
      }
      const existing = bySeller.get(match.sellerUserId)
      if (!existing) {
        bySeller.set(match.sellerUserId, {
          sellerUserId: match.sellerUserId,
          signals: [signal],
          severity,
          openSince: match.maxReviewCreatedAt,
        })
      } else {
        existing.signals.push(signal)
        if (SEVERITY_RANK[severity] > SEVERITY_RANK[existing.severity]) existing.severity = severity
        if (match.maxReviewCreatedAt < existing.openSince) existing.openSince = match.maxReviewCreatedAt
      }
    }
  }

  return [...bySeller.values()].sort((a, b) => {
    const rankDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
    if (rankDiff !== 0) return rankDiff
    return a.openSince.getTime() - b.openSince.getTime()
  })
}

function filterByTab(summaries: CaseSummary[], tab: ReputationCaseTab): CaseSummary[] {
  if (tab === "critical") return summaries.filter((s) => s.severity === "critical")
  // "buyer_reports" ties to the non_delivery_reports rule, which is never computed
  // (see design spec) — always empty until that rule has real data.
  if (tab === "buyer_reports") return []
  if (tab === "closed") return [] // closed cases are read from seller_reputation_action, not here
  return summaries
}

async function hydrateCases(summaries: CaseSummary[]): Promise<ReputationCase[]> {
  if (summaries.length === 0) return []
  const sellerIds = summaries.map((s) => s.sellerUserId)

  const userRows = await withQueryTimeout(
    db
      .select({
        id: user.id,
        name: user.name,
        image: user.image,
        premiumDealerExpiresAt: user.premiumDealerExpiresAt,
      })
      .from(user)
      .where(inArray(user.id, sellerIds)),
    QUERY_TIMEOUT_MS,
    "reputation-page-users"
  )
  const userById = new Map(userRows.map((r) => [r.id, r]))

  const aggResult = await withQueryTimeout(
    db.execute(sql`
      SELECT seller_user_id,
             avg(score) AS avg_all,
             count(*)::int AS review_count,
             avg(score) FILTER (WHERE created_at < now() - interval '30 days') AS avg_before_30d,
             count(*) FILTER (WHERE score <= 2)::int AS negative_count
      FROM seller_rating
      WHERE seller_user_id = ANY(${sellerIds})
      GROUP BY seller_user_id
    `),
    QUERY_TIMEOUT_MS,
    "reputation-page-rating-aggregates"
  )
  const aggRows = [...aggResult] as Array<{
    seller_user_id: string
    avg_all: number
    review_count: number
    avg_before_30d: number | null
    negative_count: number
  }>
  const aggBySeller = new Map(aggRows.map((r) => [r.seller_user_id, r]))

  const reviewsResult = await withQueryTimeout(
    db.execute(sql`
      SELECT ranked.seller_user_id, ranked.id, u.name AS buyer_name, ranked.score,
             ranked.comment, ranked.created_at,
             coalesce(
               array_agg(rt.name) FILTER (WHERE rt.name IS NOT NULL), '{}'
             ) AS tags
      FROM (
        SELECT sr.*, row_number() OVER (PARTITION BY sr.seller_user_id ORDER BY sr.created_at DESC) AS rn
        FROM seller_rating sr
        WHERE sr.seller_user_id = ANY(${sellerIds})
      ) ranked
      JOIN "user" u ON u.id = ranked.rater_user_id
      LEFT JOIN rating_tag_map rtm ON rtm.rating_id = ranked.id
      LEFT JOIN rating_tags rt ON rt.id = rtm.tag_id
      WHERE ranked.rn <= 3
      GROUP BY ranked.seller_user_id, ranked.id, u.name, ranked.score, ranked.comment, ranked.created_at
      ORDER BY ranked.created_at DESC
    `),
    QUERY_TIMEOUT_MS,
    "reputation-page-recent-reviews"
  )
  const reviewRows = [...reviewsResult] as Array<{
    seller_user_id: string
    id: string
    buyer_name: string
    score: number
    comment: string | null
    created_at: Date
    tags: string[]
  }>
  const reviewsBySeller = new Map<string, typeof reviewRows>()
  for (const row of reviewRows) {
    const list = reviewsBySeller.get(row.seller_user_id) ?? []
    list.push(row)
    reviewsBySeller.set(row.seller_user_id, list)
  }

  const listingRows = await withQueryTimeout(
    db
      .select({
        sellerUserId: product.sellerId,
        count: sql<number>`count(*)::int`,
      })
      .from(product)
      .where(sql`${product.sellerId} = ANY(${sellerIds}) AND ${product.status} = 'active'`)
      .groupBy(product.sellerId),
    QUERY_TIMEOUT_MS,
    "reputation-page-active-listings"
  )
  const listingsBySeller = new Map(listingRows.map((r) => [r.sellerUserId, r.count]))

  const warningRows = await withQueryTimeout(
    db
      .select({
        sellerUserId: sellerReputationAction.sellerUserId,
        count: sql<number>`count(*)::int`,
      })
      .from(sellerReputationAction)
      .where(
        sql`${sellerReputationAction.sellerUserId} = ANY(${sellerIds}) AND ${sellerReputationAction.actionType} IN ('warned', 'archived', 'limited_orders')`
      )
      .groupBy(sellerReputationAction.sellerUserId),
    QUERY_TIMEOUT_MS,
    "reputation-page-prior-warnings"
  )
  const warningsBySeller = new Map(warningRows.map((r) => [r.sellerUserId, r.count]))

  const now = Date.now()

  return summaries.map((summary) => {
    const u = userById.get(summary.sellerUserId)
    const agg = aggBySeller.get(summary.sellerUserId)
    const avgAll = agg ? Number(agg.avg_all) : 0
    const avgBefore30d = agg?.avg_before_30d != null ? Number(agg.avg_before_30d) : avgAll
    const reviewCount = agg?.review_count ?? 0
    const negativeCount = agg?.negative_count ?? 0

    return {
      id: summary.sellerUserId,
      sellerUserId: summary.sellerUserId,
      sellerName: u?.name ?? "Unknown seller",
      sellerImage: u?.image ?? null,
      isPremium: !!u?.premiumDealerExpiresAt && new Date(u.premiumDealerExpiresAt).getTime() > now,
      avgRating: avgAll,
      reviewCount,
      ratingChange30d: avgAll - avgBefore30d,
      negativeMixPct: reviewCount > 0 ? Math.round((negativeCount / reviewCount) * 100) : 0,
      signals: summary.signals,
      severity: summary.severity,
      openSince: summary.openSince,
      recentReviews: (reviewsBySeller.get(summary.sellerUserId) ?? []).map((r) => ({
        id: r.id,
        buyerName: r.buyer_name,
        score: r.score,
        comment: r.comment,
        tags: r.tags,
        createdAt: new Date(r.created_at),
      })),
      activeListingsCount: listingsBySeller.get(summary.sellerUserId) ?? 0,
      priorWarningsCount: warningsBySeller.get(summary.sellerUserId) ?? 0,
    }
  })
}

export async function getOpenReputationCases(opts: {
  tab: ReputationCaseTab
  page: number
  limit: number
}): Promise<{ cases: ReputationCase[]; total: number }> {
  const summaries = await computeCaseSummaries()
  const filtered = filterByTab(summaries, opts.tab)
  const start = (opts.page - 1) * opts.limit
  const pageSlice = filtered.slice(start, start + opts.limit)
  const cases = await hydrateCases(pageSlice)
  return { cases, total: filtered.length }
}

export async function getReputationCaseCounts(): Promise<{
  all: number
  critical: number
  buyerReports: number
  closed: number
}> {
  const summaries = await computeCaseSummaries()
  const closedCountResult = await withQueryTimeout(
    db
      .select({ count: sql<number>`count(distinct ${sellerReputationAction.sellerUserId})::int` })
      .from(sellerReputationAction)
      .where(
        sql`${sellerReputationAction.actionType} IN ('archived', 'dismissed', 'warned') AND ${sellerReputationAction.createdAt} >= now() - interval '90 days'`
      ),
    QUERY_TIMEOUT_MS,
    "reputation-closed-count"
  )
  return {
    all: summaries.length,
    critical: summaries.filter((s) => s.severity === "critical").length,
    buyerReports: 0,
    closed: closedCountResult[0]?.count ?? 0,
  }
}

export async function getReputationBadgeCounts(): Promise<{
  openCases: number
  archivedSellers: number
}> {
  const summaries = await computeCaseSummaries()
  const archivedResult = await withQueryTimeout(
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sellerArchive)
      .where(sql`${sellerArchive.restoredAt} IS NULL`),
    QUERY_TIMEOUT_MS,
    "reputation-badge-archived-count"
  )
  return {
    openCases: summaries.length,
    archivedSellers: archivedResult[0]?.count ?? 0,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- reputation-cases`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/reviews/db/reputation-cases.ts tests/unit/reputation-cases.test.ts
git commit -m "Add live threshold-based reputation case computation"
```

---

### Task 5: Mutation DB layer (archive, dismiss, secondary actions)

**Preconditions:** Task 1's migration applied.

**Files:**
- Create: `features/reviews/db/reputation-actions.ts`
- Test: `tests/unit/reputation-actions.test.ts`

**Interfaces:**
- Produces: `type ReputationActionType`, `writeReputationAction(input)`, `archiveSeller(input)`, `dismissCase(input)`, `recordSecondaryAction(input)`.
- Consumed by: Task 7 (server actions).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/reputation-actions.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/drizzle/schema/reputation-schema", () => ({
  sellerReputationAction: {
    id: "id", sellerUserId: "seller_user_id", actionType: "action_type",
    triggerKey: "trigger_key", reason: "reason", adminUserId: "admin_user_id", createdAt: "created_at",
  },
  sellerArchive: {
    id: "id", sellerUserId: "seller_user_id", reason: "reason",
    archivedByAdminId: "archived_by_admin_id", archivedAt: "archived_at",
  },
}))
vi.mock("@/drizzle/db", () => ({
  db: { insert: vi.fn() },
}))

import { db } from "@/drizzle/db"
import { archiveSeller, dismissCase, recordSecondaryAction } from "@/features/reviews/db/reputation-actions"

describe("archiveSeller", () => {
  beforeEach(() => vi.clearAllMocks())

  it("writes a seller_archive row and an 'archived' action row", async () => {
    const archiveValuesMock = vi.fn().mockResolvedValue(undefined)
    const actionValuesMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(db.insert)
      .mockReturnValueOnce({ values: archiveValuesMock } as never)
      .mockReturnValueOnce({ values: actionValuesMock } as never)

    await archiveSeller({ sellerUserId: "seller-1", reason: "Below 3.8 for 6 days", adminUserId: "admin-1" })

    expect(archiveValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ sellerUserId: "seller-1", reason: "Below 3.8 for 6 days", archivedByAdminId: "admin-1" })
    )
    expect(actionValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ sellerUserId: "seller-1", actionType: "archived", adminUserId: "admin-1" })
    )
  })
})

describe("dismissCase", () => {
  beforeEach(() => vi.clearAllMocks())

  it("writes only a 'dismissed' action row with the trigger key", async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as never)

    await dismissCase({
      sellerUserId: "seller-1",
      triggerKey: "rating_below_archive",
      reason: "Reviewed manually, rating recovering",
      adminUserId: "admin-1",
    })

    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerUserId: "seller-1",
        actionType: "dismissed",
        triggerKey: "rating_below_archive",
        adminUserId: "admin-1",
      })
    )
  })
})

describe("recordSecondaryAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("writes an action row with no reason required", async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as never)

    await recordSecondaryAction({ sellerUserId: "seller-1", actionType: "warned", adminUserId: "admin-1" })

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ sellerUserId: "seller-1", actionType: "warned", adminUserId: "admin-1" })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- reputation-actions`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// features/reviews/db/reputation-actions.ts
import { db } from "@/drizzle/db"
import { sellerReputationAction, sellerArchive } from "@/drizzle/schema/reputation-schema"
import type { ThresholdId } from "./reputation-thresholds"

export type ReputationActionType =
  | "archived"
  | "restored"
  | "dismissed"
  | "warned"
  | "limited_orders"
  | "listings_hidden"
  | "documents_requested"
  | "escalated"
  | "threshold_toggled"

export async function writeReputationAction(input: {
  sellerUserId: string | null
  actionType: ReputationActionType
  triggerKey?: ThresholdId | null
  reason?: string | null
  adminUserId: string
}): Promise<void> {
  await db.insert(sellerReputationAction).values({
    sellerUserId: input.sellerUserId,
    actionType: input.actionType,
    triggerKey: input.triggerKey ?? null,
    reason: input.reason ?? null,
    adminUserId: input.adminUserId,
  })
}

/** Archiving hides the seller (record-only in phase 1 — see design spec non-goals). */
export async function archiveSeller(input: {
  sellerUserId: string
  reason: string
  adminUserId: string
}): Promise<void> {
  await db.insert(sellerArchive).values({
    sellerUserId: input.sellerUserId,
    reason: input.reason,
    archivedByAdminId: input.adminUserId,
  })
  await writeReputationAction({
    sellerUserId: input.sellerUserId,
    actionType: "archived",
    reason: input.reason,
    adminUserId: input.adminUserId,
  })
}

/** Dismissal only writes the audit/suppression row — the seller is never archived. */
export async function dismissCase(input: {
  sellerUserId: string
  triggerKey: ThresholdId
  reason: string
  adminUserId: string
}): Promise<void> {
  await writeReputationAction({
    sellerUserId: input.sellerUserId,
    actionType: "dismissed",
    triggerKey: input.triggerKey,
    reason: input.reason,
    adminUserId: input.adminUserId,
  })
}

/**
 * Warn / limit orders / hide listings / request documents / escalate — each records intent
 * only. None has functional enforcement yet (see design spec non-goals).
 */
export async function recordSecondaryAction(input: {
  sellerUserId: string
  actionType: Extract<
    ReputationActionType,
    "warned" | "limited_orders" | "listings_hidden" | "documents_requested" | "escalated"
  >
  reason?: string
  adminUserId: string
}): Promise<void> {
  await writeReputationAction({
    sellerUserId: input.sellerUserId,
    actionType: input.actionType,
    reason: input.reason ?? null,
    adminUserId: input.adminUserId,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- reputation-actions`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/reviews/db/reputation-actions.ts tests/unit/reputation-actions.test.ts
git commit -m "Add reputation mutation DB layer (archive, dismiss, secondary actions)"
```

---

### Task 6: Zod schemas

**Files:**
- Create: `features/reviews/schemas/reputation-actions.ts`

**Interfaces:**
- Produces: `archiveSellerSchema`, `dismissCaseSchema`, `secondaryActionSchema`, `bulkArchiveSchema`, `bulkDismissSchema`, and their inferred types.
- Consumed by: Task 7 (server actions).

- [ ] **Step 1: Implement**

No separate unit test file — Zod schemas are exercised indirectly by Task 7's action tests (matching this repo's convention: `features/users/schemas/users.ts` has no dedicated test file either).

```ts
// features/reviews/schemas/reputation-actions.ts
import { z } from "zod"

const THRESHOLD_IDS = [
  "rating_below_archive",
  "negative_streak",
  "tag_concentration",
  "non_delivery_reports",
  "positive_burst",
  "auto_archive",
] as const

export const archiveSellerSchema = z.object({
  sellerUserId: z.string().min(1, "Seller is required"),
  reason: z.string().min(1, "A reason is required"),
})

export const dismissCaseSchema = z.object({
  sellerUserId: z.string().min(1, "Seller is required"),
  triggerKey: z.enum(THRESHOLD_IDS),
  reason: z.string().min(1, "A reason is required"),
})

export const secondaryActionSchema = z.object({
  sellerUserId: z.string().min(1, "Seller is required"),
  actionType: z.enum(["warned", "limited_orders", "listings_hidden", "documents_requested", "escalated"]),
  reason: z.string().optional(),
})

export const bulkArchiveSchema = z.object({
  sellerUserIds: z.array(z.string().min(1)).min(1, "Select at least one seller"),
  reason: z.string().min(1, "A reason is required"),
})

export const bulkDismissSchema = z.object({
  cases: z
    .array(z.object({ sellerUserId: z.string().min(1), triggerKey: z.enum(THRESHOLD_IDS) }))
    .min(1, "Select at least one case"),
  reason: z.string().min(1, "A reason is required"),
})

export type ArchiveSellerInput = z.infer<typeof archiveSellerSchema>
export type DismissCaseInput = z.infer<typeof dismissCaseSchema>
export type SecondaryActionInput = z.infer<typeof secondaryActionSchema>
export type BulkArchiveInput = z.infer<typeof bulkArchiveSchema>
export type BulkDismissInput = z.infer<typeof bulkDismissSchema>
```

- [ ] **Step 2: Confirm it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add features/reviews/schemas/reputation-actions.ts
git commit -m "Add Zod schemas for reputation case mutations"
```

---

### Task 7: Server actions

**Preconditions:** Tasks 3–6 complete.

**Files:**
- Create: `features/reviews/actions/reputation-cases.ts`
- Test: `tests/api/reputation-cases-actions.test.ts`

**Interfaces:**
- Consumes: `archiveSeller`, `dismissCase`, `recordSecondaryAction` from `features/reviews/db/reputation-actions.ts`; Zod schemas from Task 6; `FEATURE_KEYS.REVIEWS` from Task 2.
- Produces: `archiveSellerAction(formData)`, `dismissCaseAction(formData)`, `recordSecondaryActionAction(formData)`, `bulkArchiveSellersAction(sellerUserIds, reason)`, `bulkDismissCasesAction(cases, reason)` — all return `{ success: true } | { error: string }`.
- Consumed by: Task 10 (client table component).

- [ ] **Step 1: Write the failing test**

```ts
// tests/api/reputation-cases-actions.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }))
vi.mock("@/features/reviews/db/reputation-actions", () => ({
  archiveSeller: vi.fn().mockResolvedValue(undefined),
  dismissCase: vi.fn().mockResolvedValue(undefined),
  recordSecondaryAction: vi.fn().mockResolvedValue(undefined),
}))

const { auth } = await import("@/lib/auth")
const { checkInternalAccess } = await import("@/features/rbac/db/permissions")
const { archiveSeller, dismissCase } = await import("@/features/reviews/db/reputation-actions")
const { archiveSellerAction, dismissCaseAction } = await import("@/features/reviews/actions/reputation-cases")

function form(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

describe("archiveSellerAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects with no session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    const result = await archiveSellerAction(form({ sellerUserId: "s1", reason: "test" }))
    expect(result).toEqual({ error: "Unauthorized" })
    expect(archiveSeller).not.toHaveBeenCalled()
  })

  it("rejects internal staff without the reviews permission", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "staff-1", role: "internal" } } as never)
    vi.mocked(checkInternalAccess).mockResolvedValue(false)
    const result = await archiveSellerAction(form({ sellerUserId: "s1", reason: "test" }))
    expect(result).toEqual({ error: "Unauthorized" })
    expect(archiveSeller).not.toHaveBeenCalled()
  })

  it("rejects a missing reason", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    const result = await archiveSellerAction(form({ sellerUserId: "s1", reason: "" }))
    expect("error" in result).toBe(true)
    expect(archiveSeller).not.toHaveBeenCalled()
  })

  it("archives for an admin with a valid reason", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    const result = await archiveSellerAction(form({ sellerUserId: "s1", reason: "Below 3.8 for 6 days" }))
    expect(result).toEqual({ success: true })
    expect(archiveSeller).toHaveBeenCalledWith({
      sellerUserId: "s1",
      reason: "Below 3.8 for 6 days",
      adminUserId: "admin-1",
    })
  })

  it("allows internal staff who hold the reviews permission", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "staff-1", role: "internal" } } as never)
    vi.mocked(checkInternalAccess).mockResolvedValue(true)
    const result = await archiveSellerAction(form({ sellerUserId: "s1", reason: "test" }))
    expect(result).toEqual({ success: true })
  })
})

describe("dismissCaseAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("dismisses with a valid trigger key and reason", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    const result = await dismissCaseAction(
      form({ sellerUserId: "s1", triggerKey: "rating_below_archive", reason: "Recovering" })
    )
    expect(result).toEqual({ success: true })
    expect(dismissCase).toHaveBeenCalledWith({
      sellerUserId: "s1",
      triggerKey: "rating_below_archive",
      reason: "Recovering",
      adminUserId: "admin-1",
    })
  })

  it("rejects an invalid trigger key", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    const result = await dismissCaseAction(
      form({ sellerUserId: "s1", triggerKey: "not_a_real_rule", reason: "x" })
    )
    expect("error" in result).toBe(true)
    expect(dismissCase).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:api -- reputation-cases-actions`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// features/reviews/actions/reputation-cases.ts
"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import {
  archiveSeller,
  dismissCase,
  recordSecondaryAction,
} from "@/features/reviews/db/reputation-actions"
import {
  archiveSellerSchema,
  dismissCaseSchema,
  secondaryActionSchema,
  bulkArchiveSchema,
  bulkDismissSchema,
} from "@/features/reviews/schemas/reputation-actions"
import { zodErrorMessage } from "@/lib/form-data"

type ActionResult = { success: true } | { error: string }

async function requireReviewsSession(): Promise<{ user: { id: string; role: string } } | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  if (session.user.role === "admin") return session
  if (session.user.role === "internal") {
    const { checkInternalAccess } = await import("@/features/rbac/db/permissions")
    if (await checkInternalAccess(session.user.id, FEATURE_KEYS.REVIEWS)) return session
  }
  return null
}

export async function archiveSellerAction(formData: FormData): Promise<ActionResult> {
  const parsed = archiveSellerSchema.safeParse({
    sellerUserId: formData.get("sellerUserId"),
    reason: formData.get("reason"),
  })
  if (!parsed.success) return { error: zodErrorMessage(parsed.error) }

  const session = await requireReviewsSession()
  if (!session) return { error: "Unauthorized" }

  await archiveSeller({
    sellerUserId: parsed.data.sellerUserId,
    reason: parsed.data.reason,
    adminUserId: session.user.id,
  })
  return { success: true }
}

export async function dismissCaseAction(formData: FormData): Promise<ActionResult> {
  const parsed = dismissCaseSchema.safeParse({
    sellerUserId: formData.get("sellerUserId"),
    triggerKey: formData.get("triggerKey"),
    reason: formData.get("reason"),
  })
  if (!parsed.success) return { error: zodErrorMessage(parsed.error) }

  const session = await requireReviewsSession()
  if (!session) return { error: "Unauthorized" }

  await dismissCase({
    sellerUserId: parsed.data.sellerUserId,
    triggerKey: parsed.data.triggerKey,
    reason: parsed.data.reason,
    adminUserId: session.user.id,
  })
  return { success: true }
}

export async function recordSecondaryActionAction(formData: FormData): Promise<ActionResult> {
  const parsed = secondaryActionSchema.safeParse({
    sellerUserId: formData.get("sellerUserId"),
    actionType: formData.get("actionType"),
    reason: formData.get("reason") || undefined,
  })
  if (!parsed.success) return { error: zodErrorMessage(parsed.error) }

  const session = await requireReviewsSession()
  if (!session) return { error: "Unauthorized" }

  await recordSecondaryAction({
    sellerUserId: parsed.data.sellerUserId,
    actionType: parsed.data.actionType,
    reason: parsed.data.reason,
    adminUserId: session.user.id,
  })
  return { success: true }
}

export async function bulkArchiveSellersAction(
  sellerUserIds: string[],
  reason: string
): Promise<ActionResult> {
  const parsed = bulkArchiveSchema.safeParse({ sellerUserIds, reason })
  if (!parsed.success) return { error: zodErrorMessage(parsed.error) }

  const session = await requireReviewsSession()
  if (!session) return { error: "Unauthorized" }

  for (const sellerUserId of parsed.data.sellerUserIds) {
    await archiveSeller({ sellerUserId, reason: parsed.data.reason, adminUserId: session.user.id })
  }
  return { success: true }
}

export async function bulkDismissCasesAction(
  cases: Array<{ sellerUserId: string; triggerKey: string }>,
  reason: string
): Promise<ActionResult> {
  const parsed = bulkDismissSchema.safeParse({ cases, reason })
  if (!parsed.success) return { error: zodErrorMessage(parsed.error) }

  const session = await requireReviewsSession()
  if (!session) return { error: "Unauthorized" }

  for (const c of parsed.data.cases) {
    await dismissCase({
      sellerUserId: c.sellerUserId,
      triggerKey: c.triggerKey,
      reason: parsed.data.reason,
      adminUserId: session.user.id,
    })
  }
  return { success: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:api -- reputation-cases-actions`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/reviews/actions/reputation-cases.ts tests/api/reputation-cases-actions.test.ts
git commit -m "Add reputation case server actions with RBAC + reason validation"
```

---

### Task 8: Badge-counts API route

**Preconditions:** Task 4 complete.

**Files:**
- Create: `app/api/admin/reviews/badge-counts/route.ts`
- Test: `tests/api/admin-reviews-badge-counts.test.ts`

**Interfaces:**
- Consumes: `getReputationBadgeCounts()` from Task 4.
- Produces: `GET` handler returning `{ openCases: number; archivedSellers: number }` JSON.
- Consumed by: Task 9 (sidebar client hook).

This is a route handler (not a server action) so the sidebar's client-side badge hook can fetch it the same way `useAdminChatNotifications` fetches `/api/admin/chat/unread` — a lightweight one-shot call outside the main page render path, avoiding the connection-pool risk of computing this inside `app/admin/layout.tsx`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/api/admin-reviews-badge-counts.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }))
vi.mock("@/features/reviews/db/reputation-cases", () => ({
  getReputationBadgeCounts: vi.fn(),
}))

const { auth } = await import("@/lib/auth")
const { checkInternalAccess } = await import("@/features/rbac/db/permissions")
const { getReputationBadgeCounts } = await import("@/features/reviews/db/reputation-cases")
const { GET } = await import("@/app/api/admin/reviews/badge-counts/route")

function makeRequest(): NextRequest {
  return new Request("http://localhost/api/admin/reviews/badge-counts") as unknown as NextRequest
}

describe("GET /api/admin/reviews/badge-counts", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it("returns 403 for internal staff without the reviews permission", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "staff-1", role: "internal" } } as never)
    vi.mocked(checkInternalAccess).mockResolvedValue(false)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it("returns counts for an admin", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    vi.mocked(getReputationBadgeCounts).mockResolvedValue({ openCases: 38, archivedSellers: 29 })
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toEqual({ openCases: 38, archivedSellers: 29 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:api -- admin-reviews-badge-counts`
Expected: FAIL — route module does not exist.

- [ ] **Step 3: Implement**

```ts
// app/api/admin/reviews/badge-counts/route.ts
import { connection } from "next/server"
import type { NextRequest } from "next/server"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getReputationBadgeCounts } from "@/features/reviews/db/reputation-cases"

export async function GET(request: NextRequest) {
  await connection()
  const guard = await requireAdminOrFeature(request, FEATURE_KEYS.REVIEWS)
  if ("error" in guard) return guard.error

  const counts = await getReputationBadgeCounts()
  return Response.json(counts)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:api -- admin-reviews-badge-counts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/reviews/badge-counts/route.ts" tests/api/admin-reviews-badge-counts.test.ts
git commit -m "Add Reviews sidebar badge-counts API route"
```

---

### Task 9: Sidebar — Trust & Reputation section

**Preconditions:** Task 8 complete.

**Files:**
- Modify: `components/admin/AdminSidebar.tsx`
- Create: `features/reviews/hooks/use-reviews-badge-counts.ts`
- Test: `tests/component/admin-sidebar-reviews.test.tsx`

**Interfaces:**
- Produces: `useReviewsBadgeCounts(): { openCases: number; archivedSellers: number }` (one-shot client fetch, no realtime — this count doesn't need to be second-by-second fresh).
- Modifies `AdminSidebar.tsx`'s `navGroups` to add a `"Trust & Reputation"` group containing an expandable `Reviews` submenu with 6 children.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/component/admin-sidebar-reviews.test.tsx
import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { AdminSidebar } from "@/components/admin/AdminSidebar"

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/reviews/cases" }))
vi.mock("@/features/chat/context/admin-chat-notification-context", () => ({
  useAdminChatNotifications: () => ({ totalUnread: 0 }),
}))
vi.mock("@/features/reviews/hooks/use-reviews-badge-counts", () => ({
  useReviewsBadgeCounts: () => ({ openCases: 38, archivedSellers: 29 }),
}))

describe("AdminSidebar — Trust & Reputation", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders the Reviews submenu with all six children and the open-cases badge", () => {
    render(<AdminSidebar role="admin" permissions={{}} />)

    expect(screen.getByText("Reviews")).toBeInTheDocument()
    expect(screen.getByText("Overview")).toBeInTheDocument()
    expect(screen.getByText("Reputation cases")).toBeInTheDocument()
    expect(screen.getByText("Seller ratings")).toBeInTheDocument()
    expect(screen.getByText("Archived sellers")).toBeInTheDocument()
    expect(screen.getByText("Thresholds")).toBeInTheDocument()
    expect(screen.getByText("Audit log")).toBeInTheDocument()
    expect(screen.getByText("38")).toBeInTheDocument()
  })

  it("hides the section entirely for a role without the reviews permission", () => {
    render(<AdminSidebar role="internal" permissions={{}} />)
    expect(screen.queryByText("Reviews")).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:component -- admin-sidebar-reviews`
Expected: FAIL — `useReviewsBadgeCounts` module does not exist and the sidebar has no Reviews section yet.

- [ ] **Step 3: Write the badge-counts hook**

```ts
// features/reviews/hooks/use-reviews-badge-counts.ts
"use client"

import { useEffect, useState } from "react"

type BadgeCounts = { openCases: number; archivedSellers: number }

const EMPTY: BadgeCounts = { openCases: 0, archivedSellers: 0 }

/**
 * One-shot fetch on mount — unlike chat's unread count, this doesn't need
 * realtime push or polling, so it stays out of app/admin/layout.tsx's
 * server-render path (see connection-pool-hardening constraint in the plan).
 */
export function useReviewsBadgeCounts(): BadgeCounts {
  const [counts, setCounts] = useState<BadgeCounts>(EMPTY)

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/reviews/badge-counts", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : EMPTY))
      .then((data: BadgeCounts) => {
        if (!cancelled) setCounts(data)
      })
      .catch(() => {
        if (!cancelled) setCounts(EMPTY)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return counts
}
```

- [ ] **Step 4: Wire the sidebar section**

In `components/admin/AdminSidebar.tsx`:

Add the import (near the other feature imports):

```ts
import { useReviewsBadgeCounts } from "@/features/reviews/hooks/use-reviews-badge-counts";
```

Add `ShieldCheck` to the `lucide-react` import list at the top of the file (it isn't used elsewhere in this file yet). `ShieldAlert`, `Package`, `SlidersHorizontal`, `FileText`, and `Users` are already imported and reused below.

Define a new `NavSubMenu` entry. `AdminSidebar`'s `navGroups` is a module-level constant computed once, but the Reviews badge counts are only known at render time — so the Reviews group must be assembled *inside* the component body (not the module-level `navGroups` array) and merged with the static groups when rendering. Add this inside `AdminSidebar`, before the `return`:

```tsx
  const { openCases, archivedSellers } = useReviewsBadgeCounts();

  const reviewsGroup: NavGroup = {
    label: "Trust & Reputation",
    items: [
      {
        label: "Reviews",
        icon: ShieldCheck,
        color: "#7c3aed",
        children: [
          { href: "/admin/reviews", label: "Overview", icon: LayoutDashboard, color: "#7c3aed", featureKey: FEATURE_KEYS.REVIEWS },
          { href: "/admin/reviews/cases", label: "Reputation cases", icon: ShieldAlert, color: "#dc2626", featureKey: FEATURE_KEYS.REVIEWS },
          { href: "/admin/reviews/sellers", label: "Seller ratings", icon: Users, color: "#7c3aed", featureKey: FEATURE_KEYS.REVIEWS },
          { href: "/admin/reviews/archived", label: "Archived sellers", icon: Package, color: "#71717a", featureKey: FEATURE_KEYS.REVIEWS },
          { href: "/admin/reviews/thresholds", label: "Thresholds", icon: SlidersHorizontal, color: "#71717a", featureKey: FEATURE_KEYS.REVIEWS },
          { href: "/admin/reviews/audit", label: "Audit log", icon: FileText, color: "#71717a", featureKey: FEATURE_KEYS.REVIEWS },
        ],
      },
    ],
  };

  // navGroups[0] is the top-level Dashboard NavItem, navGroups[1] is "Master Data" — the
  // README specifies section order Dashboard, MASTER DATA, TRUST & REPUTATION, REQUESTS,
  // COMMUNICATION, so Reviews is inserted right after Master Data, not first.
  const allNavGroups: (NavItem | NavGroup)[] = [
    navGroups[0],
    navGroups[1],
    reviewsGroup,
    ...navGroups.slice(2),
  ];
```

Then change the `navGroups.map(...)` in the JSX to `allNavGroups.map(...)`.

Add the badge count to the "Reputation cases" nav item the same way the Messages badge is rendered — extend `renderNavLink` right after the existing Messages-badge block:

```tsx
        {nav.href === "/admin/reviews/cases" && openCases > 0 ? (
          <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-100 px-1.5 text-[10.5px] font-bold text-red-600">
            {openCases > 99 ? "99+" : openCases}
          </span>
        ) : null}
```

Also add a badge on the "Archived sellers" item, following the same pattern with `archivedSellers` and `nav.href === "/admin/reviews/archived"`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:component -- admin-sidebar-reviews`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/admin/AdminSidebar.tsx features/reviews/hooks/use-reviews-badge-counts.ts tests/component/admin-sidebar-reviews.test.tsx
git commit -m "Add Trust & Reputation sidebar section with live badge counts"
```

---

### Task 10: Placeholder pages for the five later-phase views

**Files:**
- Create: `features/reviews/components/ComingSoonView.tsx`
- Create: `app/admin/reviews/page.tsx`
- Create: `app/admin/reviews/sellers/page.tsx`
- Create: `app/admin/reviews/archived/page.tsx`
- Create: `app/admin/reviews/thresholds/page.tsx`
- Create: `app/admin/reviews/audit/page.tsx`
- Test: `tests/component/coming-soon-view.test.tsx`

**Interfaces:**
- Produces: `<ComingSoonView breadcrumbLabel title subhead />` — a client-free presentational component reused by all 5 placeholder pages.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/component/coming-soon-view.test.tsx
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { ComingSoonView } from "@/features/reviews/components/ComingSoonView"

describe("ComingSoonView", () => {
  it("renders the breadcrumb, title, and subhead", () => {
    render(
      <ComingSoonView
        breadcrumbLabel="Overview"
        title="Overview"
        subhead="Buyer reviews publish immediately. This is where marketplace rating and seller reputation are monitored."
      />
    )
    expect(screen.getByText("Overview")).toBeInTheDocument()
    expect(screen.getByText(/Buyer reviews publish immediately/)).toBeInTheDocument()
    expect(screen.getByText(/Coming in a later phase/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:component -- coming-soon-view`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the shared component**

```tsx
// features/reviews/components/ComingSoonView.tsx
import Link from "next/link"
import { ChevronRight } from "lucide-react"

type Props = {
  breadcrumbLabel: string
  title: string
  subhead: string
}

export function ComingSoonView({ breadcrumbLabel, title, subhead }: Props) {
  return (
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            <ChevronRight />
            <Link href="/admin/reviews">Reviews</Link>
            <ChevronRight />
            <span className="lv-here">{breadcrumbLabel}</span>
          </nav>
          <h1 className="lv-h1">{title}</h1>
          <p className="lv-subhead">{subhead}</p>
        </div>
      </div>
      <div
        className="lv-card"
        style={{ padding: "48px 24px", textAlign: "center", color: "var(--lv-text-3, #71717a)" }}
      >
        Coming in a later phase.
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:component -- coming-soon-view`
Expected: PASS

- [ ] **Step 5: Write the five placeholder pages**

```tsx
// app/admin/reviews/page.tsx
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ComingSoonView } from "@/features/reviews/components/ComingSoonView"

export default async function AdminReviewsOverviewPage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.REVIEWS)
  return (
    <ComingSoonView
      breadcrumbLabel="Overview"
      title="Overview"
      subhead="Buyer reviews publish immediately. This is where the marketplace rating and seller reputation are monitored."
    />
  )
}
```

```tsx
// app/admin/reviews/sellers/page.tsx
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ComingSoonView } from "@/features/reviews/components/ComingSoonView"

export default async function AdminReviewsSellersPage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.REVIEWS)
  return (
    <ComingSoonView
      breadcrumbLabel="Seller ratings"
      title="Seller ratings"
      subhead="Every rated seller with its rating, distribution and review volume."
    />
  )
}
```

```tsx
// app/admin/reviews/archived/page.tsx
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ComingSoonView } from "@/features/reviews/components/ComingSoonView"

export default async function AdminReviewsArchivedPage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.REVIEWS)
  return (
    <ComingSoonView
      breadcrumbLabel="Archived sellers"
      title="Archived sellers"
      subhead="Hidden from buyers and delisted. Restoring republishes the profile with its rating history intact."
    />
  )
}
```

```tsx
// app/admin/reviews/thresholds/page.tsx
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ComingSoonView } from "@/features/reviews/components/ComingSoonView"

export default async function AdminReviewsThresholdsPage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.REVIEWS)
  return (
    <ComingSoonView
      breadcrumbLabel="Case thresholds"
      title="Case thresholds"
      subhead="What opens a reputation case, and how the seller rating tags feed those rules."
    />
  )
}
```

```tsx
// app/admin/reviews/audit/page.tsx
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ComingSoonView } from "@/features/reviews/components/ComingSoonView"

export default async function AdminReviewsAuditPage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.REVIEWS)
  return (
    <ComingSoonView
      breadcrumbLabel="Audit log"
      title="Audit log"
      subhead="Every archive, restore, warning and threshold change, with the admin who made it."
    />
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add features/reviews/components/ComingSoonView.tsx tests/component/coming-soon-view.test.tsx \
  "app/admin/reviews/page.tsx" "app/admin/reviews/sellers/page.tsx" \
  "app/admin/reviews/archived/page.tsx" "app/admin/reviews/thresholds/page.tsx" \
  "app/admin/reviews/audit/page.tsx"
git commit -m "Add placeholder pages for the five later-phase Reviews views"
```

---

### Task 11: Reputation Cases page (full build)

**Preconditions:** Tasks 4, 7, 9 complete.

**Files:**
- Create: `app/admin/reviews/cases/page.tsx`
- Create: `features/reviews/components/ReputationCasesTable.tsx`
- Create: `features/reviews/components/ReputationCaseDrawer.tsx`
- Test: `tests/component/reputation-cases-table.test.tsx`

**Interfaces:**
- Consumes: `getOpenReputationCases`, `getReputationCaseCounts`, `type ReputationCase` from Task 4; `archiveSellerAction`, `dismissCaseAction`, `recordSecondaryActionAction`, `bulkArchiveSellersAction`, `bulkDismissCasesAction` from Task 7; `ListViewCard`, `ColumnDef`, `ViewTab`, `FilterDef` from `@/components/admin/list-view`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/component/reputation-cases-table.test.tsx
import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ReputationCasesTable } from "@/features/reviews/components/ReputationCasesTable"
import type { ReputationCase } from "@/features/reviews/db/reputation-cases"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/features/reviews/actions/reputation-cases", () => ({
  archiveSellerAction: vi.fn().mockResolvedValue({ success: true }),
  dismissCaseAction: vi.fn().mockResolvedValue({ success: true }),
  recordSecondaryActionAction: vi.fn().mockResolvedValue({ success: true }),
  bulkArchiveSellersAction: vi.fn().mockResolvedValue({ success: true }),
  bulkDismissCasesAction: vi.fn().mockResolvedValue({ success: true }),
}))

const CASE: ReputationCase = {
  id: "seller-1",
  sellerUserId: "seller-1",
  sellerName: "Pyin Oo Lwin Stones",
  sellerImage: null,
  isPremium: false,
  avgRating: 3.5,
  reviewCount: 40,
  ratingChange30d: -0.4,
  negativeMixPct: 23,
  signals: [
    { triggerKey: "rating_below_archive", label: "Rating below archive threshold", detail: "3.50 avg over 40 reviews (floor 3.80)", severity: "critical" },
  ],
  severity: "critical",
  openSince: new Date("2026-07-29T00:00:00Z"),
  recentReviews: [],
  activeListingsCount: 12,
  priorWarningsCount: 0,
}

describe("ReputationCasesTable", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders the seller name and severity", () => {
    render(<ReputationCasesTable cases={[CASE]} page={1} pageSize={20} total={1} activeTab="all" />)
    expect(screen.getByText("Pyin Oo Lwin Stones")).toBeInTheDocument()
  })

  it("opens the detail drawer on row click and shows the why-flagged signal", () => {
    render(<ReputationCasesTable cases={[CASE]} page={1} pageSize={20} total={1} activeTab="all" />)
    fireEvent.click(screen.getByText("Pyin Oo Lwin Stones"))
    expect(screen.getByText(/3.50 avg over 40 reviews/)).toBeInTheDocument()
  })

  it("requires a reason before confirming an archive", async () => {
    const { archiveSellerAction } = await import("@/features/reviews/actions/reputation-cases")
    render(<ReputationCasesTable cases={[CASE]} page={1} pageSize={20} total={1} activeTab="all" />)
    fireEvent.click(screen.getAllByText("Archive")[0])
    const confirmBtn = screen.getByRole("button", { name: /Confirm Archive/i })
    expect(confirmBtn).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText(/Reason for the decision/i), {
      target: { value: "Below 3.8 threshold for 6 days" },
    })
    expect(confirmBtn).not.toBeDisabled()
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(archiveSellerAction).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:component -- reputation-cases-table`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the drawer**

```tsx
// features/reviews/components/ReputationCaseDrawer.tsx
"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ReputationCase } from "@/features/reviews/db/reputation-cases"

const SECONDARY_ACTIONS: Array<{ actionType: string; label: string }> = [
  { actionType: "warned", label: "Warn seller" },
  { actionType: "limited_orders", label: "Limit new orders" },
  { actionType: "listings_hidden", label: "Hide listings only" },
  { actionType: "documents_requested", label: "Request documents" },
  { actionType: "escalated", label: "Escalate" },
]

function fmtRelative(d: Date): string {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function ReputationCaseDrawer({
  row,
  onClose,
  onArchive,
  onDismiss,
  onSecondaryAction,
  isBusy,
}: {
  row: ReputationCase
  onClose: () => void
  onArchive: (sellerUserId: string, reason: string) => void
  onDismiss: (sellerUserId: string, triggerKey: string, reason: string) => void
  onSecondaryAction: (sellerUserId: string, actionType: string) => void
  isBusy: boolean
}) {
  const [reason, setReason] = useState("")
  const primarySignal = row.signals[0]

  return (
    <>
      <div className="lv-drawer-backdrop" onClick={onClose} />
      <aside className="lv-drawer" role="dialog" aria-label="Reputation case detail">
        <header className="lv-drawer-head">
          <div>
            <div className="lv-drawer-title">Reputation case</div>
            <div className="lv-drawer-sub">{row.sellerUserId}</div>
          </div>
          <div className="lv-drawer-actions">
            <button className="lv-drawer-close" onClick={onClose} aria-label="Close">
              <X />
            </button>
          </div>
        </header>

        <div className="lv-drawer-body">
          <section className="lv-drawer-section">
            <h3 className="lv-drawer-section-h">Seller</h3>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{row.sellerName}</div>
            <div style={{ fontSize: 12.5, color: "var(--lv-text-3, #71717a)" }}>
              {row.avgRating.toFixed(2)} ★ · {row.reviewCount} reviews
            </div>
          </section>

          <section className="lv-drawer-section">
            <h3 className="lv-drawer-section-h">Why this seller is flagged</h3>
            {row.signals.map((s) => (
              <div
                key={s.triggerKey}
                style={{
                  padding: "10px 11px",
                  borderRadius: 10,
                  marginBottom: 8,
                  background: s.severity === "critical" ? "#FEF2F2" : "#FFF7ED",
                  color: s.severity === "critical" ? "#B91C1C" : "#C2410C",
                }}
              >
                <div style={{ fontWeight: 500, fontSize: 13 }}>{s.label}</div>
                <div style={{ fontSize: 12.5, opacity: 0.85 }}>{s.detail}</div>
              </div>
            ))}
          </section>

          <section className="lv-drawer-section">
            <h3 className="lv-drawer-section-h">Recent buyer reviews (read only)</h3>
            {row.recentReviews.length === 0 && (
              <p style={{ fontSize: 12.5, color: "var(--lv-text-3, #71717a)" }}>No reviews yet.</p>
            )}
            {row.recentReviews.map((r) => (
              <div key={r.id} style={{ border: "1px solid #F4F4F6", borderRadius: 11, padding: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span style={{ fontWeight: 500 }}>{r.buyerName}</span>
                  <span style={{ color: "var(--lv-text-4, #a1a1aa)" }}>{fmtRelative(r.createdAt)}</span>
                </div>
                {r.comment && <p style={{ fontSize: 12.5, color: "#52525B", marginTop: 4 }}>{r.comment}</p>}
              </div>
            ))}
          </section>

          <section className="lv-drawer-section">
            <h3 className="lv-drawer-section-h">Seller record</h3>
            <dl className="lv-kv">
              <dt>Active listings</dt>
              <dd>{row.activeListingsCount}</dd>
              <dt>Prior warnings</dt>
              <dd>{row.priorWarningsCount}</dd>
            </dl>
          </section>

          <section className="lv-drawer-section">
            <h3 className="lv-drawer-section-h">Decision</h3>
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: 10, fontSize: 12.5, marginBottom: 10 }}>
              Archiving hides the seller&apos;s profile and all {row.activeListingsCount} listings from buyers.
              Reviews stay attached to the record.
            </div>
            <textarea
              placeholder="Reason for the decision (stored in the audit log)…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={isBusy}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Button
                variant="destructive"
                size="sm"
                disabled={isBusy || !reason.trim()}
                onClick={() => onArchive(row.sellerUserId, reason.trim())}
              >
                Archive seller
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isBusy || !reason.trim() || !primarySignal}
                onClick={() => primarySignal && onDismiss(row.sellerUserId, primarySignal.triggerKey, reason.trim())}
              >
                Dismiss flag
              </Button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {SECONDARY_ACTIONS.map((a) => (
                <button
                  key={a.actionType}
                  disabled={isBusy}
                  onClick={() => onSecondaryAction(row.sellerUserId, a.actionType)}
                  className="lv-rowbtn"
                  style={{ fontSize: 12 }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </>
  )
}
```

- [ ] **Step 4: Implement the table**

```tsx
// features/reviews/components/ReputationCasesTable.tsx
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
import type { ColumnDef, ViewTab } from "@/components/admin/list-view"
import type { ReputationCase } from "@/features/reviews/db/reputation-cases"
import { ReputationCaseDrawer } from "./ReputationCaseDrawer"
import {
  archiveSellerAction,
  dismissCaseAction,
  recordSecondaryActionAction,
  bulkArchiveSellersAction,
  bulkDismissCasesAction,
} from "@/features/reviews/actions/reputation-cases"

function fmtDuration(d: Date): string {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  const days = Math.floor(diff / 86400)
  if (days >= 1) return `${days} day${days !== 1 ? "s" : ""}`
  const hours = Math.max(1, Math.floor(diff / 3600))
  return `${hours}h`
}

function buildViewHref(view: string): string {
  const p = new URLSearchParams()
  if (view !== "all") p.set("tab", view)
  p.set("page", "1")
  return `/admin/reviews/cases?${p.toString()}`
}

function buildPageHref(page: number, tab: string): string {
  const p = new URLSearchParams()
  p.set("page", String(page))
  if (tab !== "all") p.set("tab", tab)
  return `/admin/reviews/cases?${p.toString()}`
}

type Props = {
  cases: ReputationCase[]
  views?: ViewTab[]
  activeTab: string
  page: number
  pageSize: number
  total: number
}

export function ReputationCasesTable({ cases, views, activeTab, page, pageSize, total }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [archiveTarget, setArchiveTarget] = useState<ReputationCase | null>(null)
  const [archiveReason, setArchiveReason] = useState("")
  const [archiving, setArchiving] = useState(false)

  const [bulkReason, setBulkReason] = useState("")
  const [bulkMode, setBulkMode] = useState<"archive" | "dismiss" | null>(null)
  const [bulkTargets, setBulkTargets] = useState<ReputationCase[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)

  async function handleArchive(sellerUserId: string, reason: string) {
    const form = new FormData()
    form.set("sellerUserId", sellerUserId)
    form.set("reason", reason)
    const result = await archiveSellerAction(form)
    if ("error" in result) {
      toast.error("Archive failed", { description: result.error })
      return
    }
    toast.success("Seller archived", { description: "The profile and its listings are now hidden from buyers." })
    startTransition(() => router.refresh())
  }

  async function handleDismiss(sellerUserId: string, triggerKey: string, reason: string) {
    const form = new FormData()
    form.set("sellerUserId", sellerUserId)
    form.set("triggerKey", triggerKey)
    form.set("reason", reason)
    const result = await dismissCaseAction(form)
    if ("error" in result) {
      toast.error("Dismiss failed", { description: result.error })
      return
    }
    toast.success("Case dismissed")
    startTransition(() => router.refresh())
  }

  async function handleSecondaryAction(sellerUserId: string, actionType: string) {
    const form = new FormData()
    form.set("sellerUserId", sellerUserId)
    form.set("actionType", actionType)
    const result = await recordSecondaryActionAction(form)
    if ("error" in result) {
      toast.error("Action failed", { description: result.error })
      return
    }
    toast.success("Recorded")
    startTransition(() => router.refresh())
  }

  function openArchiveDialog(row: ReputationCase) {
    setArchiveTarget(row)
    setArchiveReason("")
  }

  async function confirmArchiveDialog() {
    if (!archiveTarget) return
    setArchiving(true)
    try {
      await handleArchive(archiveTarget.sellerUserId, archiveReason.trim())
      setArchiveTarget(null)
    } finally {
      setArchiving(false)
    }
  }

  function openBulk(mode: "archive" | "dismiss", rows: ReputationCase[]) {
    setBulkMode(mode)
    setBulkTargets(rows)
    setBulkReason("")
  }

  async function confirmBulk() {
    if (!bulkMode || bulkTargets.length === 0) return
    setBulkBusy(true)
    try {
      const result =
        bulkMode === "archive"
          ? await bulkArchiveSellersAction(bulkTargets.map((r) => r.sellerUserId), bulkReason.trim())
          : await bulkDismissCasesAction(
              bulkTargets
                .filter((r) => r.signals[0])
                .map((r) => ({ sellerUserId: r.sellerUserId, triggerKey: r.signals[0].triggerKey })),
              bulkReason.trim()
            )
      if ("error" in result) {
        toast.error("Bulk action failed", { description: result.error })
        return
      }
      toast.success(`${bulkTargets.length} case${bulkTargets.length !== 1 ? "s" : ""} updated`)
      setBulkMode(null)
      startTransition(() => router.refresh())
    } finally {
      setBulkBusy(false)
    }
  }

  const columnDefs: ColumnDef<ReputationCase>[] = [
    {
      id: "seller",
      label: "Seller & why it was flagged",
      flex: true,
      sortable: true,
      render: (r) => (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="lv-avatar">{r.sellerName.slice(0, 2).toUpperCase()}</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{r.sellerName}</span>
            <span style={{ fontSize: 11.5, color: "var(--lv-text-4, #a1a1aa)" }}>{r.sellerUserId}</span>
          </div>
          <div style={{ fontSize: 13.5, color: "#52525B", marginTop: 4, maxWidth: 520 }}>
            {r.signals[0]?.detail ?? ""}
          </div>
        </div>
      ),
    },
    {
      id: "rating",
      label: "Rating",
      width: 130,
      sortable: true,
      render: (r) => (
        <div>
          <span style={{ fontWeight: 500 }}>{r.avgRating.toFixed(2)} ★</span>{" "}
          <span style={{ color: r.ratingChange30d >= 0 ? "#15803D" : "#B91C1C", fontSize: 12, fontWeight: 600 }}>
            {r.ratingChange30d >= 0 ? "+" : ""}
            {r.ratingChange30d.toFixed(2)}
          </span>
          <div style={{ fontSize: 12, color: "var(--lv-text-4, #a1a1aa)" }}>{r.reviewCount} reviews</div>
        </div>
      ),
    },
    {
      id: "negativeMix",
      label: "Negative mix",
      width: 124,
      sortable: true,
      render: (r) => <span style={{ fontSize: 12, color: "#B91C1C" }}>{r.negativeMixPct}% at 1–2★</span>,
    },
    {
      id: "severity",
      label: "Severity",
      width: 128,
      sortable: true,
      render: (r) => <span className={`lv-status ${r.severity}`}>{r.severity}</span>,
    },
    {
      id: "openFor",
      label: "Open for",
      width: 104,
      sortable: true,
      render: (r) => <span>{fmtDuration(r.openSince)}</span>,
    },
  ]

  return (
    <>
      <ListViewCard
        rows={cases}
        columnDefs={columnDefs}
        views={views}
        activeView={activeTab}
        buildViewHref={buildViewHref}
        defaultSort={{ id: "severity", dir: "desc" }}
        getSortValue={(r, colId) => {
          switch (colId) {
            case "seller": return r.sellerName
            case "rating": return r.avgRating
            case "negativeMix": return r.negativeMixPct
            case "severity": return { critical: 3, high: 2, medium: 1, watch: 0 }[r.severity]
            case "openFor": return r.openSince.getTime()
            default: return ""
          }
        }}
        rowActions={(r, disabled) => (
          <>
            <button className="lv-rowbtn reject" disabled={disabled} onClick={() => openArchiveDialog(r)}>
              Archive
            </button>
            <button
              className="lv-rowbtn"
              disabled={disabled || !r.signals[0]}
              onClick={() => r.signals[0] && handleDismiss(r.sellerUserId, r.signals[0].triggerKey, "Dismissed from row action")}
            >
              Dismiss
            </button>
          </>
        )}
        renderDrawer={(r, onClose) => (
          <ReputationCaseDrawer
            row={r}
            onClose={onClose}
            onArchive={(sellerUserId, reason) => { handleArchive(sellerUserId, reason); onClose() }}
            onDismiss={(sellerUserId, triggerKey, reason) => { handleDismiss(sellerUserId, triggerKey, reason); onClose() }}
            onSecondaryAction={handleSecondaryAction}
            isBusy={false}
          />
        )}
        renderBulkActions={(selectedRows, onClear) => (
          <>
            <button className="lv-bulkbtn reject" onClick={() => openBulk("archive", selectedRows)}>
              Archive selected
            </button>
            <button className="lv-bulkbtn" onClick={() => openBulk("dismiss", selectedRows)}>
              Dismiss flags
            </button>
            <button className="lv-bulkbtn" onClick={onClear}>
              Clear
            </button>
          </>
        )}
        page={page}
        pageSize={pageSize}
        total={total}
        buildPageHref={(p) => buildPageHref(p, activeTab)}
        emptyMessage="No open cases right now."
      />

      <Dialog open={archiveTarget !== null} onOpenChange={(v) => { if (!archiving && !v) setArchiveTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Archive {archiveTarget?.sellerName}</DialogTitle>
            <DialogDescription>
              This hides the seller&apos;s profile and listings from buyers. Reviews stay attached to the record.
            </DialogDescription>
          </DialogHeader>
          <textarea
            placeholder="Reason for the decision (stored in the audit log)…"
            value={archiveReason}
            onChange={(e) => setArchiveReason(e.target.value)}
            rows={3}
            disabled={archiving}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setArchiveTarget(null)} disabled={archiving}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmArchiveDialog}
              disabled={archiving || !archiveReason.trim()}
            >
              {archiving ? "Archiving…" : "Confirm Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkMode !== null} onOpenChange={(v) => { if (!bulkBusy && !v) setBulkMode(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">
              {bulkMode === "archive" ? "Archive" : "Dismiss"} {bulkTargets.length} case{bulkTargets.length !== 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>One shared reason is recorded against every selected seller.</DialogDescription>
          </DialogHeader>
          <textarea
            placeholder="Reason for the decision (stored in the audit log)…"
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            rows={3}
            disabled={bulkBusy}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBulkMode(null)} disabled={bulkBusy}>
              Cancel
            </Button>
            <Button
              variant={bulkMode === "archive" ? "destructive" : "default"}
              size="sm"
              onClick={confirmBulk}
              disabled={bulkBusy || !bulkReason.trim()}
            >
              {bulkBusy ? "Working…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 5: Implement the page**

```tsx
// app/admin/reviews/cases/page.tsx
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getOpenReputationCases, getReputationCaseCounts } from "@/features/reviews/db/reputation-cases"
import type { ReputationCaseTab } from "@/features/reviews/db/reputation-cases"
import { ReputationCasesTable } from "@/features/reviews/components/ReputationCasesTable"
import type { ViewTab } from "@/components/admin/list-view"
import { withQueryTimeout } from "@/lib/query-timeout"

export const maxDuration = 10

const QUERY_TIMEOUT_MS = 6000
const PAGE_SIZE = 20
const TAB_VALUES: ReputationCaseTab[] = ["all", "critical", "buyer_reports", "closed"]

type Props = {
  searchParams: Promise<{ page?: string; tab?: string }>
}

export default async function AdminReputationCasesPage({ searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.REVIEWS)

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const tab: ReputationCaseTab = TAB_VALUES.includes(params.tab as ReputationCaseTab)
    ? (params.tab as ReputationCaseTab)
    : "all"

  // Sequential, not Promise.all (see Global Constraints) — both queries hit
  // seller_rating with several aggregate scans, so they don't run concurrently.
  const current = await withQueryTimeout(
    getOpenReputationCases({ tab, page, limit: PAGE_SIZE }),
    QUERY_TIMEOUT_MS,
    "reputation-cases-page"
  )
  const counts = await withQueryTimeout(
    getReputationCaseCounts(),
    QUERY_TIMEOUT_MS,
    "reputation-cases-counts"
  )

  const views: ViewTab[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "critical", label: "Critical", count: counts.critical },
    { id: "buyer_reports", label: "Buyer reports", count: counts.buyerReports },
    { id: "closed", label: "Closed", count: counts.closed },
  ]

  return (
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <span>Admin</span> <span>›</span> <span>Reviews</span> <span>›</span>{" "}
            <span className="lv-here">Reputation cases</span>
          </nav>
          <h1 className="lv-h1">
            Reputation cases
            <span className="lv-h1-count">{counts.all} open</span>
          </h1>
          <p className="lv-subhead">
            Sellers flagged by review signals. Archive hides the seller from buyers; dismiss closes
            the case with a reason.
          </p>
        </div>
      </div>

      <ReputationCasesTable
        cases={current.cases}
        views={views}
        activeTab={tab}
        page={page}
        pageSize={PAGE_SIZE}
        total={current.total}
      />
    </div>
  )
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:component -- reputation-cases-table`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add "app/admin/reviews/cases/page.tsx" features/reviews/components/ReputationCasesTable.tsx \
  features/reviews/components/ReputationCaseDrawer.tsx tests/component/reputation-cases-table.test.tsx
git commit -m "Build the Reputation Cases admin view on ListViewCard"
```

---

### Task 12: Docs + full verification

**Files:**
- Create: `docs/technical/reviews-admin-phase1.md`
- Create: `docs/guides/reviews-admin.md`
- Create: `docs/api/admin-reviews-badge-counts.md`

- [ ] **Step 1: Write the technical doc**

Cover (per this repo's CLAUDE.md "After Every Change" rule): what changed and why, with file paths; data flow (schema → case computation → page → table/drawer → server actions); schema impact (the 3 new tables, migration file name once known); auth/permissions (`FEATURE_KEYS.REVIEWS`, `requireFeatureAccess` on pages, `requireReviewsSession` in actions, `requireAdminOrFeature` on the badge-counts route); and the known limitations already listed in the design spec's "Explicit non-goals" section (link to it rather than duplicating).

- [ ] **Step 2: Write the collaborator guide**

Cover: prerequisites (migration applied, `FEATURE_KEYS.REVIEWS` granted to any internal staff who need access via the existing permissions UI); how to reach the page (`/admin/reviews/cases`, or the sidebar); how a case is computed (point to `computeCaseSummaries`); how to add a 7th threshold rule later (add to `DEFAULT_THRESHOLDS` in `reputation-thresholds.ts`, add a matcher function + entry in `RULE_MATCHERS`/`RULE_SEVERITY`/`RULE_LABELS` in `reputation-cases.ts`); common errors (forgetting to run the migration → queries throw on the missing tables; a Zod validation error surfaces as `{ error: string }` from the action, shown via `toast.error`).

- [ ] **Step 3: Write the API doc for the one new route**

Cover per CLAUDE.md's required shape: `GET /api/admin/reviews/badge-counts`, auth = admin session or internal with `FEATURE_KEYS.REVIEWS`, no request body/params, response shape `{ openCases: number; archivedSellers: number }`, error codes 401/403, an example `curl` with a session cookie, and note it's consumed by the admin sidebar (not the mobile app).

- [ ] **Step 4: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including the new ones from Tasks 2–11.

- [ ] **Step 5: Run lint**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors (warnings in unrelated pre-existing files are fine).

- [ ] **Step 6: Manual verification in a real browser**

Using the browser-testing-with-devtools skill (Chrome DevTools MCP): navigate to `/admin/reviews/cases` as an admin, confirm the sidebar shows the Trust & Reputation section with correct badge counts, confirm the table renders (or shows the empty state if no seller currently matches a rule in the dev DB), open a case's detail drawer, and confirm the console has no errors. If the dev database has no sellers matching any rule yet, note this in the technical doc rather than fabricating a passing screenshot.

- [ ] **Step 7: Commit**

```bash
git add docs/technical/reviews-admin-phase1.md docs/guides/reviews-admin.md docs/api/admin-reviews-badge-counts.md
git commit -m "Add technical doc, collaborator guide, and API doc for Reviews phase 1"
```
