# Queue Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the generic parts of the Surprise Bonus background-job queue into a reusable `lib/queue/` module, refactor Surprise Bonus onto it with full functional parity, and replace its embedded admin panel with a unified `/admin/queue` page.

**Architecture:** The `background_jobs` table and `claim_background_job` Postgres RPC are already generic (parameterized by `type`) and need no schema change. `lib/queue/` wraps them with `enqueueJob`/`claimJob`/`completeJob`/`failOrRetryJob`/`listJobs`/`getJobStatusCounts`, a `drainJobs` claim-handle-complete loop, and an in-code registry (`registerQueueJob`) so any feature can plug in a handler and show up on the admin page. Surprise Bonus's existing batch logic becomes the registered handler for `surprise_bonus_batch`, unchanged in behavior.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (postgres-js), Vitest, React 19, existing `components/admin/list-view` UI conventions.

**Spec:** `docs/superpowers/specs/2026-09-09-queue-management-design.md`

## Global Constraints

- No new SQL migrations. `background_jobs` table and `claim_background_job` RPC are reused exactly as they are.
- No cron. Processing stays inline-drain-on-enqueue plus a manual "Retry stuck jobs" admin action.
- Surprise Bonus must keep 100% functional parity: FCM push sends, in-app notifications, idempotent ledger grants, campaign progress counters, and the 3-minute stale-job reclaim all continue to work exactly as before.
- `drainJobs` aborts the whole drain on the first handler error (after recording it via `failOrRetryJob`) rather than continuing to the next job — this matches the existing `drainSurpriseBonusJobs` behavior exactly and must not be "improved" into continue-past-error, because `enqueueSurpriseBonusForAllUsers` depends on the throw propagating to report failure to the admin.
- Never run `npm run db:generate`, `db:migrate`, or `db:push` — the user applies migrations manually. This plan needs none anyway.
- Run `npm run test` (full suite) before considering any task claiming to touch shared code "done"; each task below also names its own narrower test command.
- This repo's pre-commit hook needs Node 22 via nvm: prefix every `git commit` in this plan with `export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22 &&`.
- Follow existing commit message conventions in this repo and end every commit message with the attribution line already established in this session: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: Move `background_jobs` schema into a shared queue schema

**Files:**
- Create: `drizzle/schema/queue-schema.ts`
- Modify: `drizzle/schema/surprise-bonus-schema.ts`
- Modify: `drizzle/schema.ts`
- Modify: `features/points/db/surprise-bonus.ts` (import path only)
- Modify: `features/points/services/process-surprise-bonus-jobs.ts` (import path only)

**Interfaces:**
- Consumes: nothing new.
- Produces: `backgroundJobs` (Drizzle table) importable from `@/drizzle/schema/queue-schema`. Every later task that touches `background_jobs` imports it from here.

This is a pure code move — the underlying Postgres table name (`background_jobs`), columns, and indexes are unchanged, so there is no new migration and no behavior change. The existing test suite is the regression check.

- [ ] **Step 1: Create the new schema file**

```ts
// drizzle/schema/queue-schema.ts
import { pgTable, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core"

/**
 * Database-backed job queue (no Redis). Claimed with FOR UPDATE SKIP LOCKED via RPC.
 * Generic across job types — see lib/queue/ for the shared claim/drain/retry logic
 * any feature uses on top of this table.
 */
export const backgroundJobs = pgTable(
  "background_jobs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    /** pending | processing | completed | failed */
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    availableAt: timestamp("available_at").defaultNow().notNull(),
    lockedAt: timestamp("locked_at"),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("bj_status_available_idx").on(table.status, table.availableAt),
    index("bj_type_status_idx").on(table.type, table.status),
  ],
).enableRLS()
```

- [ ] **Step 2: Remove `backgroundJobs` from `surprise-bonus-schema.ts`**

In `drizzle/schema/surprise-bonus-schema.ts`, delete the `backgroundJobs` export block (the `pgTable("background_jobs", ...)` definition) and its now-unused imports (`boolean` stays used by `appNotification`; check `jsonb`/`index` are still used by `appNotification`/`surpriseBonusCampaign` before removing — they are, so only delete the `backgroundJobs` block itself, not the shared imports). The file keeps `surpriseBonusCampaign`, `appNotification`, `SURPRISE_BONUS_JOB_TYPE`, and `pointTransactionUserTypeRefUnique`.

- [ ] **Step 3: Update the barrel export**

In `drizzle/schema.ts`, there are currently two identical lines `export * from "./schema/surprise-bonus-schema"` (an accidental duplicate). Replace both with one line, plus the new schema:

```ts
export * from "./schema/surprise-bonus-schema"
```
(appearing once, in its original first position) and add, in the same file:
```ts
export * from "./schema/queue-schema"
```

- [ ] **Step 4: Update the two import sites**

In `features/points/db/surprise-bonus.ts`, change:
```ts
import {
  backgroundJobs,
  surpriseBonusCampaign,
  SURPRISE_BONUS_JOB_TYPE,
} from "@/drizzle/schema/surprise-bonus-schema"
```
to:
```ts
import { surpriseBonusCampaign, SURPRISE_BONUS_JOB_TYPE } from "@/drizzle/schema/surprise-bonus-schema"
import { backgroundJobs } from "@/drizzle/schema/queue-schema"
```

In `features/points/services/process-surprise-bonus-jobs.ts`, make the same split for its identical import line.

- [ ] **Step 5: Run the existing test suite to confirm nothing broke**

Run: `npm run test`
Expected: all tests pass, identical to before this change (this task changes no behavior).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22 && \
git add drizzle/schema/queue-schema.ts drizzle/schema/surprise-bonus-schema.ts drizzle/schema.ts \
  features/points/db/surprise-bonus.ts features/points/services/process-surprise-bonus-jobs.ts && \
git commit -m "$(cat <<'EOF'
Move background_jobs table into a shared queue schema

Pure code move (no migration, no behavior change): background_jobs was
defined inside surprise-bonus-schema.ts even though it's already generic
(parameterized by type). Relocating it to queue-schema.ts is prep for
lib/queue, which any feature will use, not just Surprise Bonus. Also fixes
a pre-existing accidental duplicate export line in drizzle/schema.ts.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Core `lib/queue` primitives

**Files:**
- Create: `lib/queue/types.ts`
- Create: `lib/queue/queue.ts`
- Test: `tests/unit/queue.test.ts`

**Interfaces:**
- Consumes: `backgroundJobs` from `@/drizzle/schema/queue-schema` (Task 1), `db` from `@/drizzle/db`.
- Produces: `QueueJobPayload`, `ClaimedQueueJob`, `QueueJobHandler`, `QueueJobRow`, `QueueJobStatusCounts`, `QueueJobDefinition` (types); `enqueueJob(type, payload, opts?)`, `claimJob(type, lockedBy)`, `completeJob(jobId)`, `failOrRetryJob(job, error, opts?)`, `listJobs(type, limit?)`, `getJobStatusCounts(type)`, `normalizeRows(result)`, `STALE_AFTER_MS` — all from `@/lib/queue/queue`. Every later task depends on these exact names.

- [ ] **Step 1: Write the types module**

```ts
// lib/queue/types.ts
export type QueueJobPayload = Record<string, unknown>

// Deliberately NOT generic over payload type: a generic ClaimedQueueJob<TPayload>
// makes QueueJobHandler<TPayload> contravariant in TPayload, so a feature's
// handler (typed to its own payload shape) fails to type-check when assigned
// into QueueJobDefinition.handler (typed as the base QueueJobHandler) — the
// target would need TPayload assignable FROM the base QueueJobPayload, which
// a narrower payload type never satisfies. Every payload is JSONB underneath
// anyway (no runtime enforcement), so handlers cast job.payload to their own
// shape internally instead — see processSurpriseBonusJob in Task 6.
export type ClaimedQueueJob = {
  id: string
  type: string
  payload: QueueJobPayload
  attempts: number
  maxAttempts: number
}

export type QueueJobHandler = (job: ClaimedQueueJob) => Promise<void>

export type QueueJobRow = {
  id: string
  type: string
  payload: QueueJobPayload
  status: "pending" | "processing" | "completed" | "failed"
  attempts: number
  maxAttempts: number
  availableAt: Date
  lockedAt: Date | null
  lockedBy: string | null
  lastError: string | null
  createdAt: Date
  completedAt: Date | null
  isStale: boolean
}

export type QueueJobStatusCounts = {
  pending: number
  processing: number
  completed: number
  failed: number
  stale: number
}

export type QueueJobDefinition = {
  type: string
  label: string
  handler: QueueJobHandler
  /** Batch-enrich rows for the admin panel (e.g. join a campaign name). Called once per page load, not per row. */
  describeJobs?: (jobs: QueueJobRow[]) => Promise<Map<string, string>>
}
```

- [ ] **Step 2: Write the failing tests for `enqueueJob`, `claimJob`, `completeJob`, `failOrRetryJob`, `normalizeRows`**

```ts
// tests/unit/queue.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/drizzle/db", () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

import { db } from "@/drizzle/db"
import {
  claimJob,
  completeJob,
  enqueueJob,
  failOrRetryJob,
  getJobStatusCounts,
  listJobs,
  normalizeRows,
} from "@/lib/queue/queue"

function mockInsertChain(row: unknown) {
  const chain: Record<string, unknown> = {}
  chain.values = vi.fn().mockReturnValue(chain)
  chain.returning = vi.fn().mockResolvedValue([row])
  return chain
}

function mockUpdateChain() {
  const chain: Record<string, unknown> = {}
  chain.set = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockResolvedValue(undefined)
  return chain
}

function mockSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockResolvedValue(rows)
  return chain
}

describe("normalizeRows", () => {
  it("returns a plain array unchanged", () => {
    expect(normalizeRows([{ a: 1 }])).toEqual([{ a: 1 }])
  })

  it("unwraps a { rows } result shape", () => {
    expect(normalizeRows({ rows: [{ a: 1 }] })).toEqual([{ a: 1 }])
  })

  it("spreads an iterable result (postgres-js RowList)", () => {
    const source = [{ a: 1 }]
    const iterable = { [Symbol.iterator]: () => source[Symbol.iterator]() }
    expect(normalizeRows(iterable)).toEqual([{ a: 1 }])
  })

  it("returns an empty array for null/undefined", () => {
    expect(normalizeRows(null)).toEqual([])
    expect(normalizeRows(undefined)).toEqual([])
  })
})

describe("enqueueJob", () => {
  beforeEach(() => vi.clearAllMocks())

  it("inserts a pending job with default maxAttempts and availableAt=now", async () => {
    const chain = mockInsertChain({ id: "job-1" })
    vi.mocked(db.insert).mockReturnValue(chain as never)

    const result = await enqueueJob("my_type", { foo: "bar" })

    expect(result).toEqual({ id: "job-1" })
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "my_type",
        payload: { foo: "bar" },
        status: "pending",
        attempts: 0,
        maxAttempts: 5,
      }),
    )
  })

  it("honors an explicit maxAttempts and availableAt", async () => {
    const chain = mockInsertChain({ id: "job-2" })
    vi.mocked(db.insert).mockReturnValue(chain as never)
    const availableAt = new Date("2026-10-01T00:00:00Z")

    await enqueueJob("my_type", {}, { maxAttempts: 3, availableAt })

    expect(chain.values).toHaveBeenCalledWith(expect.objectContaining({ maxAttempts: 3, availableAt }))
  })
})

describe("claimJob", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns null when nothing is claimable", async () => {
    vi.mocked(db.execute).mockResolvedValue([] as never)
    const job = await claimJob("my_type", "worker-1")
    expect(job).toBeNull()
  })

  it("returns the claimed job with a parsed payload", async () => {
    vi.mocked(db.execute).mockResolvedValue([
      { id: "job-1", type: "my_type", payload: { a: 1 }, attempts: 1, max_attempts: 5 },
    ] as never)

    const job = await claimJob("my_type", "worker-1")
    expect(job).toEqual({ id: "job-1", type: "my_type", payload: { a: 1 }, attempts: 1, maxAttempts: 5 })
  })

  it("parses a JSON-string payload (raw postgres text column)", async () => {
    vi.mocked(db.execute).mockResolvedValue([
      { id: "job-1", type: "my_type", payload: '{"a":1}', attempts: 1, max_attempts: 5 },
    ] as never)

    const job = await claimJob("my_type", "worker-1")
    expect(job?.payload).toEqual({ a: 1 })
  })
})

describe("completeJob", () => {
  it("marks the job completed and clears the lock", async () => {
    const chain = mockUpdateChain()
    vi.mocked(db.update).mockReturnValue(chain as never)

    await completeJob("job-1")

    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed", lockedAt: null, lockedBy: null }),
    )
  })
})

describe("failOrRetryJob", () => {
  beforeEach(() => vi.clearAllMocks())

  it("retries with default backoff (min(attempts*2, 30) minutes) when attempts remain", async () => {
    const chain = mockUpdateChain()
    vi.mocked(db.update).mockReturnValue(chain as never)

    await failOrRetryJob({ id: "job-1", type: "t", payload: {}, attempts: 2, maxAttempts: 5 }, "boom")

    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", lastError: "boom", lockedAt: null, lockedBy: null }),
    )
    const setArg = (chain.set as ReturnType<typeof vi.fn>).mock.calls[0][0] as { availableAt: Date }
    expect(setArg.availableAt.getTime()).toBeGreaterThan(Date.now() + 3.9 * 60_000)
    expect(setArg.availableAt.getTime()).toBeLessThan(Date.now() + 4.1 * 60_000)
  })

  it("marks failed once attempts reach maxAttempts", async () => {
    const chain = mockUpdateChain()
    vi.mocked(db.update).mockReturnValue(chain as never)

    await failOrRetryJob({ id: "job-1", type: "t", payload: {}, attempts: 5, maxAttempts: 5 }, "boom")

    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", lastError: "boom", lockedAt: null, lockedBy: null }),
    )
  })

  it("honors a custom backoff function", async () => {
    const chain = mockUpdateChain()
    vi.mocked(db.update).mockReturnValue(chain as never)

    await failOrRetryJob(
      { id: "job-1", type: "t", payload: {}, attempts: 1, maxAttempts: 5 },
      "boom",
      { backoffMinutes: () => 1 },
    )

    const setArg = (chain.set as ReturnType<typeof vi.fn>).mock.calls[0][0] as { availableAt: Date }
    expect(setArg.availableAt.getTime()).toBeGreaterThan(Date.now() + 0.9 * 60_000)
    expect(setArg.availableAt.getTime()).toBeLessThan(Date.now() + 1.1 * 60_000)
  })
})

describe("listJobs", () => {
  beforeEach(() => vi.clearAllMocks())

  it("flags a processing job whose lock is older than 3 minutes as stale", async () => {
    const fourMinutesAgo = new Date(Date.now() - 4 * 60_000)
    vi.mocked(db.select).mockReturnValue(
      mockSelectChain([
        {
          id: "job-1", type: "t", payload: {}, status: "processing", attempts: 1, maxAttempts: 5,
          availableAt: new Date(), lockedAt: fourMinutesAgo, lockedBy: "worker-1", lastError: null,
          createdAt: new Date(), completedAt: null,
        },
      ]) as never,
    )

    const rows = await listJobs("t")
    expect(rows[0]).toMatchObject({ id: "job-1", isStale: true })
  })

  it("does not flag a processing job locked less than 3 minutes ago", async () => {
    const oneMinuteAgo = new Date(Date.now() - 60_000)
    vi.mocked(db.select).mockReturnValue(
      mockSelectChain([
        {
          id: "job-2", type: "t", payload: {}, status: "processing", attempts: 1, maxAttempts: 5,
          availableAt: new Date(), lockedAt: oneMinuteAgo, lockedBy: "worker-1", lastError: null,
          createdAt: new Date(), completedAt: null,
        },
      ]) as never,
    )

    const rows = await listJobs("t")
    expect(rows[0]).toMatchObject({ id: "job-2", isStale: false })
  })

  it("never flags completed/pending/failed jobs as stale, regardless of lockedAt", async () => {
    const longAgo = new Date(Date.now() - 60 * 60_000)
    vi.mocked(db.select).mockReturnValue(
      mockSelectChain([
        {
          id: "job-3", type: "t", payload: {}, status: "completed", attempts: 1, maxAttempts: 5,
          availableAt: new Date(), lockedAt: longAgo, lockedBy: null, lastError: null,
          createdAt: new Date(), completedAt: new Date(),
        },
      ]) as never,
    )

    const rows = await listJobs("t")
    expect(rows[0]).toMatchObject({ id: "job-3", isStale: false })
  })

  it("does not flag a processing job with no lockedAt as stale", async () => {
    vi.mocked(db.select).mockReturnValue(
      mockSelectChain([
        {
          id: "job-4", type: "t", payload: {}, status: "processing", attempts: 0, maxAttempts: 5,
          availableAt: new Date(), lockedAt: null, lockedBy: null, lastError: null,
          createdAt: new Date(), completedAt: null,
        },
      ]) as never,
    )

    const rows = await listJobs("t")
    expect(rows[0]).toMatchObject({ id: "job-4", isStale: false })
  })
})

describe("getJobStatusCounts", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns the counts row from the grouped query", async () => {
    const chain: Record<string, unknown> = {}
    chain.from = vi.fn().mockReturnValue(chain)
    chain.where = vi.fn().mockResolvedValue([{ pending: 2, processing: 1, completed: 40, failed: 0, stale: 1 }])
    vi.mocked(db.select).mockReturnValue(chain as never)

    const counts = await getJobStatusCounts("t")
    expect(counts).toEqual({ pending: 2, processing: 1, completed: 40, failed: 0, stale: 1 })
  })

  it("falls back to all-zero counts when the query returns no row", async () => {
    const chain: Record<string, unknown> = {}
    chain.from = vi.fn().mockReturnValue(chain)
    chain.where = vi.fn().mockResolvedValue([])
    vi.mocked(db.select).mockReturnValue(chain as never)

    const counts = await getJobStatusCounts("t")
    expect(counts).toEqual({ pending: 0, processing: 0, completed: 0, failed: 0, stale: 0 })
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:unit -- queue.test.ts`
Expected: FAIL — `Cannot find module '@/lib/queue/queue'`.

- [ ] **Step 4: Write `lib/queue/queue.ts`**

```ts
// lib/queue/queue.ts
import { desc, eq, sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { backgroundJobs } from "@/drizzle/schema/queue-schema"
import type { ClaimedQueueJob, QueueJobPayload, QueueJobRow, QueueJobStatusCounts } from "@/lib/queue/types"

/** Matches the reclaim window baked into claim_background_job (migration 0087). */
export const STALE_AFTER_MS = 3 * 60 * 1000

const DEFAULT_MAX_ATTEMPTS = 5

/** Normalizes drizzle/postgres-js raw execute() results (array, RowList, or { rows }). */
export function normalizeRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && Array.isArray((result as { rows: unknown }).rows)) {
    return (result as { rows: T[] }).rows
  }
  if (result && typeof result === "object" && Symbol.iterator in (result as object)) {
    return [...(result as Iterable<T>)]
  }
  return []
}

export async function enqueueJob(
  type: string,
  payload: QueueJobPayload,
  opts?: { maxAttempts?: number; availableAt?: Date },
): Promise<{ id: string }> {
  const [row] = await db
    .insert(backgroundJobs)
    .values({
      type,
      payload,
      status: "pending",
      attempts: 0,
      maxAttempts: opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      availableAt: opts?.availableAt ?? new Date(),
    })
    .returning({ id: backgroundJobs.id })
  return row
}

type ClaimedJobRawRow = {
  id: string
  type: string
  payload: QueueJobPayload | string
  attempts: number
  max_attempts: number
}

/** Claims one due/stale job of `type` via claim_background_job (FOR UPDATE SKIP LOCKED, with stale-lock reclaim). */
export async function claimJob(type: string, lockedBy: string): Promise<ClaimedQueueJob | null> {
  const rows = normalizeRows<ClaimedJobRawRow>(
    await db.execute(sql`SELECT * FROM claim_background_job(${type}, ${lockedBy})`),
  )
  const job = rows[0]
  if (!job?.id) return null

  const payload = typeof job.payload === "string" ? (JSON.parse(job.payload) as QueueJobPayload) : job.payload

  return {
    id: job.id,
    type: job.type,
    payload,
    attempts: job.attempts,
    maxAttempts: job.max_attempts,
  }
}

export async function completeJob(jobId: string): Promise<void> {
  await db
    .update(backgroundJobs)
    .set({
      status: "completed",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    })
    .where(eq(backgroundJobs.id, jobId))
}

export async function failOrRetryJob(
  job: ClaimedQueueJob,
  error: string,
  opts?: { backoffMinutes?: (attempts: number) => number },
): Promise<void> {
  const backoffMinutes = opts?.backoffMinutes ?? ((attempts: number) => Math.min(attempts * 2, 30))

  if (job.attempts >= job.maxAttempts) {
    await db
      .update(backgroundJobs)
      .set({
        status: "failed",
        lastError: error,
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      })
      .where(eq(backgroundJobs.id, job.id))
    return
  }

  await db
    .update(backgroundJobs)
    .set({
      status: "pending",
      lastError: error,
      availableAt: new Date(Date.now() + backoffMinutes(job.attempts) * 60_000),
      lockedAt: null,
      lockedBy: null,
    })
    .where(eq(backgroundJobs.id, job.id))
}

export async function listJobs(type: string, limit = 100): Promise<QueueJobRow[]> {
  const rows = await db
    .select({
      id: backgroundJobs.id,
      type: backgroundJobs.type,
      payload: backgroundJobs.payload,
      status: backgroundJobs.status,
      attempts: backgroundJobs.attempts,
      maxAttempts: backgroundJobs.maxAttempts,
      availableAt: backgroundJobs.availableAt,
      lockedAt: backgroundJobs.lockedAt,
      lockedBy: backgroundJobs.lockedBy,
      lastError: backgroundJobs.lastError,
      createdAt: backgroundJobs.createdAt,
      completedAt: backgroundJobs.completedAt,
    })
    .from(backgroundJobs)
    .where(eq(backgroundJobs.type, type))
    .orderBy(desc(backgroundJobs.createdAt))
    .limit(limit)

  const now = Date.now()
  return rows.map((r) => ({
    ...r,
    status: r.status as QueueJobRow["status"],
    isStale: r.status === "processing" && r.lockedAt !== null && now - r.lockedAt.getTime() > STALE_AFTER_MS,
  }))
}

export async function getJobStatusCounts(type: string): Promise<QueueJobStatusCounts> {
  const [row] = await db
    .select({
      pending: sql<number>`count(*) filter (where status = 'pending')::int`,
      processing: sql<number>`count(*) filter (where status = 'processing')::int`,
      completed: sql<number>`count(*) filter (where status = 'completed')::int`,
      failed: sql<number>`count(*) filter (where status = 'failed')::int`,
      stale: sql<number>`count(*) filter (
        where status = 'processing' and locked_at < now() - interval '3 minutes'
      )::int`,
    })
    .from(backgroundJobs)
    .where(eq(backgroundJobs.type, type))
  return row ?? { pending: 0, processing: 0, completed: 0, failed: 0, stale: 0 }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:unit -- queue.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 6: Commit**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22 && \
git add lib/queue/types.ts lib/queue/queue.ts tests/unit/queue.test.ts && \
git commit -m "$(cat <<'EOF'
Add lib/queue core primitives (enqueue/claim/complete/failOrRetry/list)

Generalizes the claim/retry/backoff/listing logic that today only exists
inline in features/points/services/process-surprise-bonus-jobs.ts and
features/points/db/surprise-bonus.ts, so any feature can reuse it against
the existing background_jobs table without duplicating this code.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `lib/queue` drain loop

**Files:**
- Create: `lib/queue/drain.ts`
- Test: `tests/unit/queue-drain.test.ts`

**Interfaces:**
- Consumes: `claimJob`, `completeJob`, `failOrRetryJob` from `@/lib/queue/queue` (Task 2); `QueueJobHandler` from `@/lib/queue/types`.
- Produces: `drainJobs(type, handler, opts?): Promise<{ batches: number }>` from `@/lib/queue/drain`. Tasks 7 (enqueue-surprise-bonus refactor) and 8 (admin retry route) call this directly.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/queue-drain.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/queue/queue", () => ({
  claimJob: vi.fn(),
  completeJob: vi.fn(),
  failOrRetryJob: vi.fn(),
}))

import { claimJob, completeJob, failOrRetryJob } from "@/lib/queue/queue"
import { drainJobs } from "@/lib/queue/drain"

describe("drainJobs", () => {
  beforeEach(() => vi.clearAllMocks())

  it("stops once the queue has no more claimable jobs", async () => {
    vi.mocked(claimJob)
      .mockResolvedValueOnce({ id: "job-1", type: "t", payload: {}, attempts: 1, maxAttempts: 5 })
      .mockResolvedValueOnce(null)

    const handler = vi.fn().mockResolvedValue(undefined)
    const result = await drainJobs("t", handler)

    expect(result).toEqual({ batches: 1 })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(completeJob).toHaveBeenCalledWith("job-1")
  })

  it("stops after maxBatches even if more jobs are claimable", async () => {
    vi.mocked(claimJob).mockResolvedValue({ id: "job-x", type: "t", payload: {}, attempts: 1, maxAttempts: 5 })
    const handler = vi.fn().mockResolvedValue(undefined)

    const result = await drainJobs("t", handler, { maxBatches: 3 })

    expect(result).toEqual({ batches: 3 })
    expect(handler).toHaveBeenCalledTimes(3)
  })

  it("records the failure via failOrRetryJob and rethrows, aborting the drain", async () => {
    vi.mocked(claimJob).mockResolvedValueOnce({ id: "job-1", type: "t", payload: {}, attempts: 1, maxAttempts: 5 })

    const handler = vi.fn().mockRejectedValueOnce(new Error("boom"))

    await expect(drainJobs("t", handler)).rejects.toThrow("boom")

    expect(claimJob).toHaveBeenCalledTimes(1)
    expect(failOrRetryJob).toHaveBeenCalledWith(
      { id: "job-1", type: "t", payload: {}, attempts: 1, maxAttempts: 5 },
      "boom",
    )
    expect(completeJob).not.toHaveBeenCalled()
  })

  it("passes a custom lockedBy through to claimJob", async () => {
    vi.mocked(claimJob).mockResolvedValueOnce(null)
    await drainJobs("t", vi.fn(), { lockedBy: "worker-42" })
    expect(claimJob).toHaveBeenCalledWith("t", "worker-42")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- queue-drain.test.ts`
Expected: FAIL — `Cannot find module '@/lib/queue/drain'`.

- [ ] **Step 3: Write `lib/queue/drain.ts`**

```ts
// lib/queue/drain.ts
import { claimJob, completeJob, failOrRetryJob } from "@/lib/queue/queue"
import type { QueueJobHandler } from "@/lib/queue/types"

/**
 * Claims and processes jobs of `type` until the queue is empty or `maxBatches`
 * is reached. A handler error is recorded via failOrRetryJob (backoff, or
 * terminal `failed` once maxAttempts is reached) and then rethrown, aborting
 * the drain — this matches process-surprise-bonus-jobs.ts's original
 * behavior exactly. Callers such as enqueueSurpriseBonusForAllUsers depend
 * on that throw propagating out of an inline drain to report failure to
 * their own caller, so this must not swallow-and-continue.
 */
export async function drainJobs(
  type: string,
  handler: QueueJobHandler,
  opts?: { maxBatches?: number; lockedBy?: string },
): Promise<{ batches: number }> {
  const maxBatches = opts?.maxBatches ?? 10_000
  const lockedBy = opts?.lockedBy ?? `local-${crypto.randomUUID().slice(0, 8)}`
  let batches = 0

  while (batches < maxBatches) {
    const job = await claimJob(type, lockedBy)
    if (!job) break
    batches++

    try {
      await handler(job)
      await completeJob(job.id)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await failOrRetryJob(job, message)
      throw e
    }
  }

  return { batches }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- queue-drain.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22 && \
git add lib/queue/drain.ts tests/unit/queue-drain.test.ts && \
git commit -m "$(cat <<'EOF'
Add lib/queue drain loop (claim, handle, complete or fail/retry)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `lib/queue` job-type registry

**Files:**
- Create: `lib/queue/registry.ts`
- Test: `tests/unit/queue-registry.test.ts`

**Interfaces:**
- Consumes: `QueueJobDefinition` from `@/lib/queue/types`.
- Produces: `registerQueueJob(def)`, `getQueueJobDefinition(type)`, `listRegisteredJobTypes()` from `@/lib/queue/registry`. Task 6 calls `registerQueueJob`; Tasks 8-9 call the other two.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/queue-registry.test.ts
import { describe, expect, it, vi } from "vitest"
import { getQueueJobDefinition, listRegisteredJobTypes, registerQueueJob } from "@/lib/queue/registry"

describe("queue registry", () => {
  it("registers and retrieves a job definition by type", () => {
    const handler = vi.fn()
    registerQueueJob({ type: "test_type_a", label: "Test A", handler })

    expect(getQueueJobDefinition("test_type_a")).toEqual({ type: "test_type_a", label: "Test A", handler })
  })

  it("returns undefined for an unregistered type", () => {
    expect(getQueueJobDefinition("nonexistent_type")).toBeUndefined()
  })

  it("lists all registered types with their labels", () => {
    registerQueueJob({ type: "test_type_b", label: "Test B", handler: vi.fn() })
    registerQueueJob({ type: "test_type_c", label: "Test C", handler: vi.fn() })

    const types = listRegisteredJobTypes()
    expect(types).toEqual(
      expect.arrayContaining([
        { type: "test_type_b", label: "Test B" },
        { type: "test_type_c", label: "Test C" },
      ]),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- queue-registry.test.ts`
Expected: FAIL — `Cannot find module '@/lib/queue/registry'`.

- [ ] **Step 3: Write `lib/queue/registry.ts`**

```ts
// lib/queue/registry.ts
import type { QueueJobDefinition } from "@/lib/queue/types"

const registry = new Map<string, QueueJobDefinition>()

export function registerQueueJob(def: QueueJobDefinition): void {
  registry.set(def.type, def)
}

export function getQueueJobDefinition(type: string): QueueJobDefinition | undefined {
  return registry.get(type)
}

export function listRegisteredJobTypes(): { type: string; label: string }[] {
  return [...registry.values()].map((d) => ({ type: d.type, label: d.label }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- queue-registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22 && \
git add lib/queue/registry.ts tests/unit/queue-registry.test.ts && \
git commit -m "$(cat <<'EOF'
Add lib/queue in-code job-type registry

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: RBAC — `FEATURE_KEYS.QUEUE_MANAGEMENT`

**Files:**
- Modify: `features/rbac/feature-keys.ts`
- Modify: `tests/unit/feature-keys.test.ts`

**Interfaces:**
- Consumes: existing `FEATURE_KEYS`/`FEATURE_GROUPS` shape.
- Produces: `FEATURE_KEYS.QUEUE_MANAGEMENT` (value `"queue_management"`), a new `"System"` entry in `FEATURE_GROUPS`. Tasks 8-9 use this key to gate the new routes/page/nav item.

- [ ] **Step 1: Add the key and group**

In `features/rbac/feature-keys.ts`, add to the `FEATURE_KEYS` object (after `REVIEWS`):

```ts
  REVIEWS:                   "reviews",
  QUEUE_MANAGEMENT:          "queue_management",
} as const
```

Add a new group at the end of `FEATURE_GROUPS` (after the `"Trust & Reputation"` group):

```ts
  {
    label: "Trust & Reputation",
    features: [
      { key: FEATURE_KEYS.REVIEWS, label: "Reviews & Seller Reputation" },
    ],
  },
  {
    label: "System",
    features: [
      { key: FEATURE_KEYS.QUEUE_MANAGEMENT, label: "Queue Management" },
    ],
  },
]
```

- [ ] **Step 2: Write the test**

Append to `tests/unit/feature-keys.test.ts`:

```ts
describe("System feature group", () => {
  it("exposes a Queue Management toggle", () => {
    const system = FEATURE_GROUPS.find((g) => g.label === "System")
    expect(system?.features).toHaveLength(1)
    expect(system?.features[0].key).toBe(FEATURE_KEYS.QUEUE_MANAGEMENT)
  })
})
```

- [ ] **Step 3: Run the test**

Run: `npm run test:unit -- feature-keys.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22 && \
git add features/rbac/feature-keys.ts tests/unit/feature-keys.test.ts && \
git commit -m "$(cat <<'EOF'
Add QUEUE_MANAGEMENT RBAC feature key for the admin queue page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Refactor Surprise Bonus processing onto `lib/queue`

**Files:**
- Modify: `features/points/services/process-surprise-bonus-jobs.ts` (full rewrite)
- Modify: `features/points/db/surprise-bonus.ts` (remove job functions, add `describeSurpriseBonusJobs`)
- Create: `lib/queue/registrations.ts`
- Modify: `tests/unit/process-surprise-bonus-jobs.test.ts` (full rewrite)

**Interfaces:**
- Consumes: `enqueueJob`, `normalizeRows` from `@/lib/queue/queue` (Task 2); `registerQueueJob` from `@/lib/queue/registry` (Task 4); `QueueJobRow`, `ClaimedQueueJob` from `@/lib/queue/types`.
- Produces: `processSurpriseBonusJob(job): Promise<void>` (the registered handler) and `describeSurpriseBonusJobs(jobs): Promise<Map<string,string>>`, both exported — Task 7 imports `processSurpriseBonusJob`; `lib/queue/registrations.ts` imports the module for its registration side effect.

- [ ] **Step 1: Rewrite `features/points/db/surprise-bonus.ts`**

Remove `enqueueSurpriseBonusBatchJob`, `listSurpriseBonusJobs`, `getSurpriseBonusJobStatusCounts`, `SurpriseBonusJobRow`, `SurpriseBonusJobStatusCounts`, the `jobCampaignId` sql helper, the `STALE_AFTER_MS` constant, and the `backgroundJobs`/`SURPRISE_BONUS_JOB_TYPE` imports. Add `describeSurpriseBonusJobs`. Full resulting file:

```ts
// features/points/db/surprise-bonus.ts
import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { surpriseBonusCampaign } from "@/drizzle/schema/surprise-bonus-schema"
import type { QueueJobRow } from "@/lib/queue/types"
import { and, eq, inArray, sql } from "drizzle-orm"

export type SurpriseBonusCampaignRow = typeof surpriseBonusCampaign.$inferSelect

export type SurpriseBonusCampaignProgress = {
  id: string
  name: string
  pointsPerUser: number
  recipientType: string
  note: string | null
  totalUsers: number
  processedUsers: number
  successCount: number
  failedCount: number
  status: string
  createdBy: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export async function countActiveUsers(): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(user)
    .where(and(eq(user.banned, false), eq(user.archived, false)))
  return row?.value ?? 0
}

export async function createSurpriseBonusCampaign(input: {
  name: string
  pointsPerUser: number
  note?: string | null
  totalUsers: number
  createdBy: string
}): Promise<SurpriseBonusCampaignRow> {
  const [row] = await db
    .insert(surpriseBonusCampaign)
    .values({
      name: input.name,
      pointsPerUser: input.pointsPerUser,
      recipientType: "all_users",
      note: input.note?.trim() || null,
      totalUsers: input.totalUsers,
      processedUsers: 0,
      successCount: 0,
      failedCount: 0,
      status: "pending",
      createdBy: input.createdBy,
    })
    .returning()
  return row
}

export async function markSurpriseBonusCampaignProcessing(campaignId: string): Promise<void> {
  await db
    .update(surpriseBonusCampaign)
    .set({ status: "processing", startedAt: new Date(), updatedAt: new Date() })
    .where(eq(surpriseBonusCampaign.id, campaignId))
}

export async function getSurpriseBonusCampaignById(
  campaignId: string,
): Promise<SurpriseBonusCampaignProgress | null> {
  const [row] = await db
    .select()
    .from(surpriseBonusCampaign)
    .where(eq(surpriseBonusCampaign.id, campaignId))
    .limit(1)
  return row ?? null
}

/**
 * Batch-enrich queue admin rows with their campaign name (one query for the
 * whole page, not per row) — the describeJobs hook for the surprise_bonus_batch
 * queue job type.
 */
export async function describeSurpriseBonusJobs(jobs: QueueJobRow[]): Promise<Map<string, string>> {
  const campaignIds = [
    ...new Set(
      jobs
        .map((j) => (j.payload as { campaignId?: string }).campaignId)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  if (campaignIds.length === 0) return new Map()

  const campaigns = await db
    .select({ id: surpriseBonusCampaign.id, name: surpriseBonusCampaign.name })
    .from(surpriseBonusCampaign)
    .where(inArray(surpriseBonusCampaign.id, campaignIds))

  const nameById = new Map(campaigns.map((c) => [c.id, c.name]))
  const result = new Map<string, string>()
  for (const job of jobs) {
    const campaignId = (job.payload as { campaignId?: string }).campaignId
    if (campaignId && nameById.has(campaignId)) {
      result.set(job.id, nameById.get(campaignId)!)
    }
  }
  return result
}
```

- [ ] **Step 2: Rewrite `features/points/services/process-surprise-bonus-jobs.ts`**

```ts
// features/points/services/process-surprise-bonus-jobs.ts
import { and, asc, eq, gt, sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { surpriseBonusCampaign, SURPRISE_BONUS_JOB_TYPE } from "@/drizzle/schema/surprise-bonus-schema"
import { describeSurpriseBonusJobs } from "@/features/points/db/surprise-bonus"
import { sendSurpriseBonusPushToUsers } from "@/features/points/services/surprise-bonus-push"
import { enqueueJob, normalizeRows } from "@/lib/queue/queue"
import { registerQueueJob } from "@/lib/queue/registry"
import type { ClaimedQueueJob } from "@/lib/queue/types"

const BATCH_SIZE = 100

type SurpriseBonusPayload = { campaignId?: string; lastUserId?: string | null }
type GrantResult = { granted?: boolean; reason?: string; points?: number }

/**
 * The registered lib/queue handler for SURPRISE_BONUS_JOB_TYPE. Claiming,
 * completing, and retry/backoff are all handled by lib/queue/drain.ts's
 * drainJobs — this function only implements the surprise-bonus-specific
 * batch: grant up to BATCH_SIZE users, update campaign progress, push FCM
 * to newly granted users, and chain the next batch if more users remain.
 */
export async function processSurpriseBonusJob(job: ClaimedQueueJob): Promise<void> {
  const payload = job.payload as SurpriseBonusPayload
  const campaignId = payload.campaignId
  if (!campaignId) throw new Error("Missing campaignId in payload")

  const lastUserId = payload.lastUserId ?? null

  const conditions = [eq(user.banned, false), eq(user.archived, false)]
  if (lastUserId) conditions.push(gt(user.id, lastUserId))

  const batch = await db
    .select({ id: user.id })
    .from(user)
    .where(and(...conditions))
    .orderBy(asc(user.id))
    .limit(BATCH_SIZE)

  let successDelta = 0
  let failedDelta = 0
  const newlyGrantedUserIds: string[] = []

  for (const u of batch) {
    const grantRows = normalizeRows<{ result: GrantResult | string }>(
      await db.execute(sql`SELECT grant_surprise_bonus_user(${campaignId}, ${u.id}) AS result`),
    )

    let result: GrantResult | string | undefined = grantRows[0]?.result
    if (typeof result === "string") {
      try {
        result = JSON.parse(result) as GrantResult
      } catch {
        result = undefined
      }
    }

    if (result?.granted === true) {
      successDelta++
      newlyGrantedUserIds.push(u.id)
    } else if (result?.reason === "already_granted") {
      successDelta++
    } else if (result?.reason === "user_not_found" || result?.reason === "campaign_not_found") {
      failedDelta++
    } else {
      successDelta++
    }
  }

  const [campaign] = await db
    .select({
      name: surpriseBonusCampaign.name,
      pointsPerUser: surpriseBonusCampaign.pointsPerUser,
      processedUsers: surpriseBonusCampaign.processedUsers,
      successCount: surpriseBonusCampaign.successCount,
      failedCount: surpriseBonusCampaign.failedCount,
    })
    .from(surpriseBonusCampaign)
    .where(eq(surpriseBonusCampaign.id, campaignId))
    .limit(1)

  const processedUsers = (campaign?.processedUsers ?? 0) + batch.length
  const successCount = (campaign?.successCount ?? 0) + successDelta
  const failedCount = (campaign?.failedCount ?? 0) + failedDelta
  const hasMore = batch.length === BATCH_SIZE
  const campaignStatus = hasMore ? ("processing" as const) : ("completed" as const)

  const campaignUpdate: {
    processedUsers: number
    successCount: number
    failedCount: number
    status: "processing" | "completed"
    updatedAt: Date
    completedAt?: Date
  } = {
    processedUsers,
    successCount,
    failedCount,
    status: campaignStatus,
    updatedAt: new Date(),
  }
  if (!hasMore) campaignUpdate.completedAt = new Date()

  await db.update(surpriseBonusCampaign).set(campaignUpdate).where(eq(surpriseBonusCampaign.id, campaignId))

  if (hasMore) {
    const nextLastId = batch[batch.length - 1]!.id
    await enqueueJob(SURPRISE_BONUS_JOB_TYPE, { campaignId, lastUserId: nextLastId })
  }

  if (newlyGrantedUserIds.length > 0 && campaign) {
    await sendSurpriseBonusPushToUsers({
      userIds: newlyGrantedUserIds,
      campaignId,
      campaignName: campaign.name,
      pointsPerUser: campaign.pointsPerUser,
    })
  }
}

registerQueueJob({
  type: SURPRISE_BONUS_JOB_TYPE,
  label: "Surprise Bonus",
  handler: processSurpriseBonusJob,
  describeJobs: describeSurpriseBonusJobs,
})
```

- [ ] **Step 3: Create `lib/queue/registrations.ts`**

```ts
// lib/queue/registrations.ts
// Side-effect-only: importing this file registers every feature's queue job
// handler (each registration module calls registerQueueJob at module load).
// Add one import per feature that wants to show up on /admin/queue.
import "@/features/points/services/process-surprise-bonus-jobs"
```

- [ ] **Step 4: Rewrite `tests/unit/process-surprise-bonus-jobs.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/drizzle/db", () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/features/points/services/surprise-bonus-push", () => ({
  sendSurpriseBonusPushToUsers: vi.fn().mockResolvedValue({ sent: 2, failed: 0, invalidTokensRemoved: 0 }),
}))

vi.mock("@/lib/queue/queue", () => ({
  enqueueJob: vi.fn(),
  normalizeRows: (result: unknown) => (Array.isArray(result) ? result : []),
}))

vi.mock("@/lib/queue/registry", () => ({
  registerQueueJob: vi.fn(),
}))

vi.mock("@/features/points/db/surprise-bonus", () => ({
  describeSurpriseBonusJobs: vi.fn(),
}))

import { sendSurpriseBonusPushToUsers } from "@/features/points/services/surprise-bonus-push"
import { db } from "@/drizzle/db"
import { enqueueJob } from "@/lib/queue/queue"
import { registerQueueJob } from "@/lib/queue/registry"
import { SURPRISE_BONUS_JOB_TYPE } from "@/drizzle/schema/surprise-bonus-schema"
import { processSurpriseBonusJob } from "@/features/points/services/process-surprise-bonus-jobs"

function mockSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockResolvedValue(rows)
  return chain
}

function mockUpdateChain() {
  const chain: Record<string, unknown> = {}
  chain.set = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockResolvedValue(undefined)
  return chain
}

function claimedJob(payload: { campaignId?: string; lastUserId?: string | null }) {
  return { id: "job-1", type: SURPRISE_BONUS_JOB_TYPE, payload, attempts: 1, maxAttempts: 5 }
}

describe("processSurpriseBonusJob", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sendSurpriseBonusPushToUsers).mockResolvedValue({ sent: 2, failed: 0, invalidTokensRemoved: 0 })
  })

  it("registers itself as the surprise_bonus_batch queue job handler on import", () => {
    expect(registerQueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SURPRISE_BONUS_JOB_TYPE,
        label: "Surprise Bonus",
        handler: processSurpriseBonusJob,
      }),
    )
  })

  it("throws when the job payload has no campaignId", async () => {
    await expect(processSurpriseBonusJob(claimedJob({}))).rejects.toThrow("Missing campaignId in payload")
  })

  it("grants a batch, sends FCM for newly granted users, completes the campaign", async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([{ result: { granted: true, points: 500 } }] as never)
      .mockResolvedValueOnce([{ result: { granted: true, points: 500 } }] as never)

    const userSelect = mockSelectChain([{ id: "u1" }, { id: "u2" }])
    const campaignSelect = mockSelectChain([
      { name: "Sweet December", pointsPerUser: 500, processedUsers: 0, successCount: 0, failedCount: 0 },
    ])
    vi.mocked(db.select).mockReturnValueOnce(userSelect as never).mockReturnValueOnce(campaignSelect as never)
    vi.mocked(db.update).mockReturnValue(mockUpdateChain() as never)

    await processSurpriseBonusJob(claimedJob({ campaignId: "camp-1", lastUserId: null }))

    expect(sendSurpriseBonusPushToUsers).toHaveBeenCalledWith({
      userIds: ["u1", "u2"],
      campaignId: "camp-1",
      campaignName: "Sweet December",
      pointsPerUser: 500,
    })
    expect(enqueueJob).not.toHaveBeenCalled()
  })

  it("does not push for already_granted users", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([{ result: { granted: false, reason: "already_granted" } }] as never)

    const userSelect = mockSelectChain([{ id: "u1" }])
    const campaignSelect = mockSelectChain([
      { name: "Sweet December", pointsPerUser: 500, processedUsers: 0, successCount: 0, failedCount: 0 },
    ])
    vi.mocked(db.select).mockReturnValueOnce(userSelect as never).mockReturnValueOnce(campaignSelect as never)
    vi.mocked(db.update).mockReturnValue(mockUpdateChain() as never)

    await processSurpriseBonusJob(claimedJob({ campaignId: "camp-1", lastUserId: null }))
    expect(sendSurpriseBonusPushToUsers).not.toHaveBeenCalled()
  })

  it("chains the next batch via enqueueJob when a full batch (more users remain) is processed", async () => {
    const fullBatch = Array.from({ length: 100 }, (_, i) => ({ id: `u${i}` }))
    vi.mocked(db.execute).mockResolvedValue([{ result: { granted: true, points: 10 } }] as never)

    const userSelect = mockSelectChain(fullBatch)
    const campaignSelect = mockSelectChain([
      { name: "X", pointsPerUser: 10, processedUsers: 0, successCount: 0, failedCount: 0 },
    ])
    vi.mocked(db.select).mockReturnValueOnce(userSelect as never).mockReturnValueOnce(campaignSelect as never)
    vi.mocked(db.update).mockReturnValue(mockUpdateChain() as never)

    await processSurpriseBonusJob(claimedJob({ campaignId: "camp-1", lastUserId: null }))

    expect(enqueueJob).toHaveBeenCalledWith(SURPRISE_BONUS_JOB_TYPE, { campaignId: "camp-1", lastUserId: "u99" })
  })
})
```

- [ ] **Step 5: Run the tests**

Run: `npm run test:unit -- process-surprise-bonus-jobs.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. (`enqueue-surprise-bonus.ts` will still reference the now-removed `enqueueSurpriseBonusBatchJob`/`drainSurpriseBonusJobs` at this point — that's fixed in Task 7, next. If this typecheck fails only because of `enqueue-surprise-bonus.ts`, that's expected and acceptable to leave for Task 7; confirm no *other* file fails.)

- [ ] **Step 7: Commit**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22 && \
git add features/points/services/process-surprise-bonus-jobs.ts features/points/db/surprise-bonus.ts \
  lib/queue/registrations.ts tests/unit/process-surprise-bonus-jobs.test.ts && \
git commit -m "$(cat <<'EOF'
Refactor Surprise Bonus batch processing onto lib/queue

processOneSurpriseBonusBatch/drainSurpriseBonusJobs become
processSurpriseBonusJob, a plain lib/queue handler registered for
surprise_bonus_batch — claim/complete/retry/backoff now come from
lib/queue/drain.ts instead of being hand-rolled here. All business logic
(grant loop, campaign progress, FCM push, batch chaining) is unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Refactor Surprise Bonus enqueue path onto `lib/queue`

**Files:**
- Modify: `features/points/services/enqueue-surprise-bonus.ts`
- Modify: `tests/unit/enqueue-surprise-bonus.test.ts` (full rewrite)

**Interfaces:**
- Consumes: `enqueueJob` from `@/lib/queue/queue` (Task 2), `drainJobs` from `@/lib/queue/drain` (Task 3), `processSurpriseBonusJob` from `@/features/points/services/process-surprise-bonus-jobs` (Task 6).
- Produces: `enqueueSurpriseBonusForAllUsers` — same signature and return shape as before; `app/api/admin/points/surprise-bonus/route.ts` (untouched) keeps working unchanged.

- [ ] **Step 1: Rewrite `features/points/services/enqueue-surprise-bonus.ts`**

```ts
// features/points/services/enqueue-surprise-bonus.ts
import { SURPRISE_BONUS_JOB_TYPE } from "@/drizzle/schema/surprise-bonus-schema"
import {
  countActiveUsers,
  createSurpriseBonusCampaign,
  markSurpriseBonusCampaignProcessing,
} from "@/features/points/db/surprise-bonus"
import { processSurpriseBonusJob } from "@/features/points/services/process-surprise-bonus-jobs"
import { drainJobs } from "@/lib/queue/drain"
import { enqueueJob } from "@/lib/queue/queue"

export type EnqueueSurpriseBonusInput = {
  campaignName: string
  pointsPerUser: number
  note?: string
  createdBy: string
}

export type EnqueueSurpriseBonusResult =
  | {
      success: true
      campaignId: string
      totalUsers: number
      pointsPerUser: number
      campaignName: string
      /** Always true: jobs are drained in this request before responding. */
      processedInline: true
    }
  | { error: string }

/**
 * Create campaign + first background job, then credit users inline in this
 * request (no cron / background worker involved). If a very large campaign's
 * drain gets cut off by `maxDuration`, the next Top-up submission reclaims
 * the stranded job automatically (`claim_background_job`, migration 0087).
 */
export async function enqueueSurpriseBonusForAllUsers(
  input: EnqueueSurpriseBonusInput,
): Promise<EnqueueSurpriseBonusResult> {
  const points = Math.floor(Number(input.pointsPerUser))
  if (isNaN(points) || points <= 0) {
    return { error: "Amount must be a positive number." }
  }

  const campaignName = input.campaignName.trim()
  if (!campaignName) return { error: "Campaign name is required." }

  const totalUsers = await countActiveUsers()
  if (totalUsers === 0) return { error: "No active users found." }

  const campaign = await createSurpriseBonusCampaign({
    name: campaignName,
    pointsPerUser: points,
    note: input.note,
    totalUsers,
    createdBy: input.createdBy,
  })

  await enqueueJob(SURPRISE_BONUS_JOB_TYPE, { campaignId: campaign.id, lastUserId: null })

  await markSurpriseBonusCampaignProcessing(campaign.id)

  // Cap batches from known user count (+ slack) so a stuck queue cannot loop forever.
  const maxBatches = Math.max(1, Math.ceil(totalUsers / 100) + 2)

  try {
    const drained = await drainJobs(SURPRISE_BONUS_JOB_TYPE, processSurpriseBonusJob, { maxBatches })
    if (drained.batches === 0) {
      console.warn(
        "[surprise-bonus] inline drain claimed 0 batches — check claim_background_job RPC / pending jobs",
        { campaignId: campaign.id },
      )
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[surprise-bonus] inline drain failed:", e)
    return {
      error: `Campaign created but crediting failed: ${message}. Check RPCs (claim_background_job / grant_surprise_bonus_user) and retry the Top-up.`,
    }
  }

  return {
    success: true,
    campaignId: campaign.id,
    totalUsers,
    pointsPerUser: points,
    campaignName,
    processedInline: true,
  }
}
```

- [ ] **Step 2: Rewrite `tests/unit/enqueue-surprise-bonus.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/features/points/db/surprise-bonus", () => ({
  countActiveUsers: vi.fn(),
  createSurpriseBonusCampaign: vi.fn(),
  markSurpriseBonusCampaignProcessing: vi.fn(),
}))

vi.mock("@/lib/queue/queue", () => ({
  enqueueJob: vi.fn(),
}))

vi.mock("@/lib/queue/drain", () => ({
  drainJobs: vi.fn(),
}))

vi.mock("@/features/points/services/process-surprise-bonus-jobs", () => ({
  processSurpriseBonusJob: vi.fn(),
}))

import {
  countActiveUsers,
  createSurpriseBonusCampaign,
  markSurpriseBonusCampaignProcessing,
} from "@/features/points/db/surprise-bonus"
import { enqueueJob } from "@/lib/queue/queue"
import { drainJobs } from "@/lib/queue/drain"
import { processSurpriseBonusJob } from "@/features/points/services/process-surprise-bonus-jobs"
import { SURPRISE_BONUS_JOB_TYPE } from "@/drizzle/schema/surprise-bonus-schema"
import { enqueueSurpriseBonusForAllUsers } from "@/features/points/services/enqueue-surprise-bonus"

describe("enqueueSurpriseBonusForAllUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createSurpriseBonusCampaign).mockResolvedValue({
      id: "camp-1",
      name: "Sweet December",
      pointsPerUser: 500,
      recipientType: "all_users",
      note: null,
      totalUsers: 2,
      processedUsers: 0,
      successCount: 0,
      failedCount: 0,
      status: "pending",
      createdBy: "admin-1",
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(enqueueJob).mockResolvedValue({ id: "job-1" })
    vi.mocked(drainJobs).mockResolvedValue({ batches: 0 })
  })

  it("rejects non-positive points", async () => {
    const result = await enqueueSurpriseBonusForAllUsers({
      campaignName: "Sweet December",
      pointsPerUser: 0,
      createdBy: "admin-1",
    })
    expect(result).toEqual({ error: "Amount must be a positive number." })
  })

  it("rejects empty campaign name", async () => {
    const result = await enqueueSurpriseBonusForAllUsers({
      campaignName: "  ",
      pointsPerUser: 500,
      createdBy: "admin-1",
    })
    expect(result).toEqual({ error: "Campaign name is required." })
  })

  it("creates campaign, enqueues the first job, and drains it inline before responding", async () => {
    vi.mocked(countActiveUsers).mockResolvedValue(250)
    vi.mocked(drainJobs).mockResolvedValue({ batches: 3 })

    const result = await enqueueSurpriseBonusForAllUsers({
      campaignName: "Sweet December",
      pointsPerUser: 500,
      note: "Holiday",
      createdBy: "admin-1",
    })

    expect(result).toEqual({
      success: true,
      campaignId: "camp-1",
      totalUsers: 250,
      pointsPerUser: 500,
      campaignName: "Sweet December",
      processedInline: true,
    })
    expect(createSurpriseBonusCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Sweet December", pointsPerUser: 500, totalUsers: 250, createdBy: "admin-1" }),
    )
    expect(enqueueJob).toHaveBeenCalledWith(SURPRISE_BONUS_JOB_TYPE, { campaignId: "camp-1", lastUserId: null })
    expect(markSurpriseBonusCampaignProcessing).toHaveBeenCalledWith("camp-1")
    expect(drainJobs).toHaveBeenCalledWith(SURPRISE_BONUS_JOB_TYPE, processSurpriseBonusJob, { maxBatches: 5 })
  })

  it("returns an error and leaves the campaign row in place when the inline drain throws", async () => {
    vi.mocked(countActiveUsers).mockResolvedValue(250)
    vi.mocked(drainJobs).mockRejectedValue(new Error("relation missing"))

    const result = await enqueueSurpriseBonusForAllUsers({
      campaignName: "Sweet December",
      pointsPerUser: 500,
      createdBy: "admin-1",
    })

    expect(result).toEqual({
      error:
        "Campaign created but crediting failed: relation missing. Check RPCs (claim_background_job / grant_surprise_bonus_user) and retry the Top-up.",
    })
  })

  it("returns error when no active users", async () => {
    vi.mocked(countActiveUsers).mockResolvedValue(0)
    const result = await enqueueSurpriseBonusForAllUsers({
      campaignName: "Sweet December",
      pointsPerUser: 500,
      createdBy: "admin-1",
    })
    expect(result).toEqual({ error: "No active users found." })
  })
})
```

- [ ] **Step 3: Run the tests**

Run: `npm run test:unit -- enqueue-surprise-bonus.test.ts`
Expected: PASS.

- [ ] **Step 4: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including `tests/api/admin/surprise-bonus.test.ts` and `tests/unit/surprise-bonus-stale-job-reclaim.test.ts` (both untouched and should be unaffected — this run confirms it). `tests/api/admin/surprise-bonus-jobs.test.ts` and `tests/unit/surprise-bonus-jobs-db.test.ts` will now fail (they reference functions removed in Task 6) — that's expected and resolved by Task 10.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors (the routes/panel deleted in Task 10 still exist and still compile against the current code at this point).

- [ ] **Step 6: Commit**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22 && \
git add features/points/services/enqueue-surprise-bonus.ts tests/unit/enqueue-surprise-bonus.test.ts && \
git commit -m "$(cat <<'EOF'
Refactor Surprise Bonus enqueue path onto lib/queue

enqueueSurpriseBonusForAllUsers now calls lib/queue's enqueueJob/drainJobs
instead of the removed enqueueSurpriseBonusBatchJob/drainSurpriseBonusJobs.
Orchestration (campaign creation, maxBatches sizing, error reporting on a
failed inline drain) is unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Generic admin API routes

**Files:**
- Create: `app/api/admin/queue/route.ts`
- Create: `app/api/admin/queue/retry/route.ts`
- Test: `tests/api/admin/queue.test.ts`

**Interfaces:**
- Consumes: `getJobStatusCounts`, `listJobs` from `@/lib/queue/queue`; `drainJobs` from `@/lib/queue/drain`; `getQueueJobDefinition`, `listRegisteredJobTypes` from `@/lib/queue/registry`; `@/lib/queue/registrations` (import for side effect); `requireAdminOrFeature` from `@/lib/api-guard`; `FEATURE_KEYS.QUEUE_MANAGEMENT` (Task 5).
- Produces: `GET /api/admin/queue`, `GET /api/admin/queue?type=`, `POST /api/admin/queue/retry`. Task 9's `QueueDashboard` component calls these.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/api/admin/queue.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"

vi.mock("next/server", () => ({ connection: vi.fn() }))

vi.mock("@/lib/api-guard", () => ({
  requireAdminOrFeature: vi.fn(),
}))

vi.mock("@/lib/queue/queue", () => ({
  getJobStatusCounts: vi.fn(),
  listJobs: vi.fn(),
}))

vi.mock("@/lib/queue/drain", () => ({
  drainJobs: vi.fn(),
}))

vi.mock("@/lib/queue/registry", () => ({
  listRegisteredJobTypes: vi.fn(),
  getQueueJobDefinition: vi.fn(),
}))

vi.mock("@/lib/queue/registrations", () => ({}))

import { requireAdminOrFeature } from "@/lib/api-guard"
import { getJobStatusCounts, listJobs } from "@/lib/queue/queue"
import { drainJobs } from "@/lib/queue/drain"
import { getQueueJobDefinition, listRegisteredJobTypes } from "@/lib/queue/registry"
import { GET } from "@/app/api/admin/queue/route"
import { POST } from "@/app/api/admin/queue/retry/route"

function req(method: string, path: string, body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }) as NextRequest
}

describe("GET /api/admin/queue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(requireAdminOrFeature).mockResolvedValue({
      session: { user: { id: "admin-1", role: "admin" } },
    } as never)
  })

  it("returns 401 when unauthorized", async () => {
    vi.mocked(requireAdminOrFeature).mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as never)

    const res = await GET(req("GET", "/api/admin/queue"))
    expect(res.status).toBe(401)
  })

  it("without a type: returns status counts for every registered type", async () => {
    vi.mocked(listRegisteredJobTypes).mockReturnValue([{ type: "surprise_bonus_batch", label: "Surprise Bonus" }])
    vi.mocked(getJobStatusCounts).mockResolvedValue({ pending: 1, processing: 0, completed: 5, failed: 0, stale: 0 })

    const res = await GET(req("GET", "/api/admin/queue"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      types: [
        {
          type: "surprise_bonus_batch",
          label: "Surprise Bonus",
          counts: { pending: 1, processing: 0, completed: 5, failed: 0, stale: 0 },
        },
      ],
    })
  })

  it("returns 404 for an unknown type", async () => {
    vi.mocked(listRegisteredJobTypes).mockReturnValue([])
    vi.mocked(getQueueJobDefinition).mockReturnValue(undefined)

    const res = await GET(req("GET", "/api/admin/queue?type=unknown_type"))
    expect(res.status).toBe(404)
  })

  it("with a type: returns counts, jobs, and description text from describeJobs", async () => {
    vi.mocked(listRegisteredJobTypes).mockReturnValue([{ type: "surprise_bonus_batch", label: "Surprise Bonus" }])
    vi.mocked(getQueueJobDefinition).mockReturnValue({
      type: "surprise_bonus_batch",
      label: "Surprise Bonus",
      handler: vi.fn(),
      describeJobs: vi.fn().mockResolvedValue(new Map([["job-1", "Sweet December"]])),
    })
    vi.mocked(getJobStatusCounts).mockResolvedValue({ pending: 0, processing: 1, completed: 0, failed: 0, stale: 0 })
    const lockedAt = new Date("2026-09-08T10:00:00Z")
    vi.mocked(listJobs).mockResolvedValue([
      {
        id: "job-1", type: "surprise_bonus_batch", payload: {}, status: "processing",
        attempts: 1, maxAttempts: 5, availableAt: new Date("2026-09-08T09:59:00Z"),
        lockedAt, lockedBy: "local-abc123", lastError: null,
        createdAt: new Date("2026-09-08T09:58:00Z"), completedAt: null, isStale: true,
      },
    ])

    const res = await GET(req("GET", "/api/admin/queue?type=surprise_bonus_batch"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.selectedType).toBe("surprise_bonus_batch")
    expect(body.counts).toEqual({ pending: 0, processing: 1, completed: 0, failed: 0, stale: 0 })
    expect(body.jobs).toEqual([
      {
        id: "job-1", status: "processing", isStale: true, attempts: 1, maxAttempts: 5,
        availableAt: "2026-09-08T09:59:00.000Z", lockedAt: "2026-09-08T10:00:00.000Z",
        lockedBy: "local-abc123", lastError: null,
        createdAt: "2026-09-08T09:58:00.000Z", completedAt: null, description: "Sweet December",
      },
    ])
  })
})

describe("POST /api/admin/queue/retry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(requireAdminOrFeature).mockResolvedValue({
      session: { user: { id: "admin-1", role: "admin" } },
    } as never)
  })

  it("returns 401 when unauthorized", async () => {
    vi.mocked(requireAdminOrFeature).mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as never)

    const res = await POST(req("POST", "/api/admin/queue/retry", { type: "surprise_bonus_batch" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 when type is missing", async () => {
    const res = await POST(req("POST", "/api/admin/queue/retry", {}))
    expect(res.status).toBe(400)
  })

  it("returns 404 for an unknown type", async () => {
    vi.mocked(getQueueJobDefinition).mockReturnValue(undefined)
    const res = await POST(req("POST", "/api/admin/queue/retry", { type: "unknown_type" }))
    expect(res.status).toBe(404)
  })

  it("runs a drain pass and reports how many batches it processed", async () => {
    const handler = vi.fn()
    vi.mocked(getQueueJobDefinition).mockReturnValue({ type: "surprise_bonus_batch", label: "Surprise Bonus", handler })
    vi.mocked(drainJobs).mockResolvedValue({ batches: 2 })

    const res = await POST(req("POST", "/api/admin/queue/retry", { type: "surprise_bonus_batch" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, batches: 2 })
    expect(drainJobs).toHaveBeenCalledWith("surprise_bonus_batch", handler, { maxBatches: 50 })
  })

  it("returns 500 with a descriptive message when the drain throws", async () => {
    vi.mocked(getQueueJobDefinition).mockReturnValue({ type: "surprise_bonus_batch", label: "Surprise Bonus", handler: vi.fn() })
    vi.mocked(drainJobs).mockRejectedValue(new Error("relation missing"))

    const res = await POST(req("POST", "/api/admin/queue/retry", { type: "surprise_bonus_batch" }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Retry failed: relation missing")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:api -- queue.test.ts`
Expected: FAIL — routes don't exist yet.

- [ ] **Step 3: Write `app/api/admin/queue/route.ts`**

```ts
// app/api/admin/queue/route.ts
import { connection, NextRequest } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getJobStatusCounts, listJobs } from "@/lib/queue/queue"
import { getQueueJobDefinition, listRegisteredJobTypes } from "@/lib/queue/registry"
import "@/lib/queue/registrations"

/**
 * GET /api/admin/queue
 * GET /api/admin/queue?type=<type>
 * Without `type`: status counts for every registered job type.
 * With `type`: that type's status counts plus its most recent jobs,
 * enriched via that type's optional describeJobs hook.
 */
export async function GET(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.QUEUE_MANAGEMENT)
  if ("error" in gate) return gate.error

  const type = new URL(request.url).searchParams.get("type")
  const types = listRegisteredJobTypes()

  if (!type) {
    const counts = await Promise.all(
      types.map(async (t) => ({ ...t, counts: await getJobStatusCounts(t.type) })),
    )
    return jsonUncached({ types: counts })
  }

  const definition = getQueueJobDefinition(type)
  if (!definition) return jsonError(`Unknown job type: ${type}`, 404)

  const [counts, jobs] = await Promise.all([getJobStatusCounts(type), listJobs(type, 100)])
  const descriptions = definition.describeJobs ? await definition.describeJobs(jobs) : new Map<string, string>()

  return jsonUncached({
    types,
    selectedType: type,
    counts,
    jobs: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      isStale: j.isStale,
      attempts: j.attempts,
      maxAttempts: j.maxAttempts,
      availableAt: j.availableAt.toISOString(),
      lockedAt: j.lockedAt?.toISOString() ?? null,
      lockedBy: j.lockedBy,
      lastError: j.lastError,
      createdAt: j.createdAt.toISOString(),
      completedAt: j.completedAt?.toISOString() ?? null,
      description: descriptions.get(j.id) ?? null,
    })),
  })
}
```

- [ ] **Step 4: Write `app/api/admin/queue/retry/route.ts`**

```ts
// app/api/admin/queue/retry/route.ts
import { connection, NextRequest } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { drainJobs } from "@/lib/queue/drain"
import { getQueueJobDefinition } from "@/lib/queue/registry"
import "@/lib/queue/registrations"

/** Room for several batches in one manual retry. */
export const maxDuration = 60

/** Cap per invocation so a single click cannot run forever. */
const MAX_BATCHES_PER_RUN = 50

/**
 * POST /api/admin/queue/retry
 * Body: { type: string }
 * Manual "Retry stuck jobs" action: runs one drain pass for the given type —
 * reclaims anything stranded `processing` (per claim_background_job's stale
 * window) and finishes any due `pending` jobs.
 */
export async function POST(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.QUEUE_MANAGEMENT)
  if ("error" in gate) return gate.error

  const body = (await request.json().catch(() => null)) as { type?: string } | null
  const type = body?.type
  if (!type) return jsonError("type is required", 400)

  const definition = getQueueJobDefinition(type)
  if (!definition) return jsonError(`Unknown job type: ${type}`, 404)

  try {
    const result = await drainJobs(type, definition.handler, { maxBatches: MAX_BATCHES_PER_RUN })
    return jsonUncached({ success: true, batches: result.batches })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[queue:${type}] manual retry drain failed:`, e)
    return jsonError(`Retry failed: ${message}`, 500)
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:api -- queue.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22 && \
git add app/api/admin/queue tests/api/admin/queue.test.ts && \
git commit -m "$(cat <<'EOF'
Add generic admin queue API routes (GET status/list, POST retry)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Unified `/admin/queue` page

**Files:**
- Create: `app/admin/queue/page.tsx`
- Create: `components/admin/queue/QueueDashboard.tsx`
- Modify: `components/admin/AdminSidebar.tsx`
- Test: `tests/component/queue-dashboard.test.tsx`
- Test: `tests/component/admin-sidebar-queue.test.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/queue[?type=]`, `POST /api/admin/queue/retry` (Task 8); `requireFeatureAccess` from `@/lib/admin-guard`; `FEATURE_KEYS.QUEUE_MANAGEMENT` (Task 5); `StatusPill` from `@/components/admin/list-view/StatusPill`.
- Produces: the `/admin/queue` route and a "Queue" sidebar link under a new "System" group.

- [ ] **Step 1: Write the failing component tests**

```tsx
// tests/component/queue-dashboard.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { QueueDashboard } from "@/components/admin/queue/QueueDashboard"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function mockFetchSequence(responses: Array<{ ok?: boolean; json: unknown }>) {
  let call = 0
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const r = responses[Math.min(call, responses.length - 1)]!
      call++
      return { ok: r.ok ?? true, json: async () => r.json }
    }),
  )
}

describe("QueueDashboard", () => {
  it("shows an empty state when no job types are registered", async () => {
    mockFetchSequence([{ json: { types: [] } }])

    render(<QueueDashboard />)

    expect(await screen.findByText("No job types registered yet.")).toBeInTheDocument()
  })

  it("loads types then the selected type's counts and jobs", async () => {
    mockFetchSequence([
      { json: { types: [{ type: "surprise_bonus_batch", label: "Surprise Bonus" }] } },
      {
        json: {
          counts: { pending: 1, processing: 0, completed: 5, failed: 0, stale: 0 },
          jobs: [
            {
              id: "job-1", status: "completed", isStale: false, attempts: 1, maxAttempts: 5,
              availableAt: "2026-09-08T09:59:00.000Z", lockedAt: null, lockedBy: null, lastError: null,
              createdAt: "2026-09-08T09:58:00.000Z", completedAt: "2026-09-08T10:00:00.000Z",
              description: "Sweet December",
            },
          ],
        },
      },
    ])

    render(<QueueDashboard />)

    expect(await screen.findByText("Sweet December")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Surprise Bonus" })).toBeInTheDocument()
  })

  it("clicking Retry stuck jobs posts to the retry endpoint with the selected type", async () => {
    mockFetchSequence([
      { json: { types: [{ type: "surprise_bonus_batch", label: "Surprise Bonus" }] } },
      { json: { counts: { pending: 0, processing: 1, completed: 0, failed: 0, stale: 1 }, jobs: [] } },
      { json: { success: true, batches: 2 } },
      { json: { types: [{ type: "surprise_bonus_batch", label: "Surprise Bonus" }] } },
      { json: { counts: { pending: 0, processing: 0, completed: 2, failed: 0, stale: 0 }, jobs: [] } },
    ])

    render(<QueueDashboard />)
    await screen.findByRole("button", { name: /retry stuck jobs/i })

    fireEvent.click(screen.getByRole("button", { name: /retry stuck jobs/i }))

    await waitFor(() => {
      const fetchMock = vi.mocked(fetch)
      const retryCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/retry"))
      expect(retryCall).toBeDefined()
      expect(retryCall![1]).toMatchObject({ method: "POST", body: JSON.stringify({ type: "surprise_bonus_batch" }) })
    })
  })
})
```

```tsx
// tests/component/admin-sidebar-queue.test.tsx
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"

afterEach(cleanup)

let mockPathname = "/admin"

vi.mock("next/navigation", () => ({ usePathname: () => mockPathname }))
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} />,
}))
vi.mock("@/features/chat/context/admin-chat-notification-context", () => ({
  useAdminChatNotifications: () => ({ totalUnread: 0 }),
}))

beforeEach(() => {
  mockPathname = "/admin"
})

describe("AdminSidebar System group", () => {
  it("shows a Queue link to admins", () => {
    render(<AdminSidebar role="admin" permissions={{}} />)
    expect(screen.getByRole("link", { name: "Queue" })).toHaveAttribute("href", "/admin/queue")
  })

  it("hides Queue from internal staff without the queue_management permission", () => {
    render(<AdminSidebar role="internal" permissions={{}} />)
    expect(screen.queryByRole("link", { name: "Queue" })).not.toBeInTheDocument()
  })

  it("shows Queue to internal staff granted the queue_management permission", () => {
    render(<AdminSidebar role="internal" permissions={{ [FEATURE_KEYS.QUEUE_MANAGEMENT]: true }} />)
    expect(screen.getByRole("link", { name: "Queue" })).toHaveAttribute("href", "/admin/queue")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:component -- queue-dashboard.test.tsx admin-sidebar-queue.test.tsx`
Expected: FAIL — `QueueDashboard` doesn't exist yet; sidebar has no Queue link yet.

- [ ] **Step 3: Write `components/admin/queue/QueueDashboard.tsx`**

```tsx
// components/admin/queue/QueueDashboard.tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { StatusPill } from "@/components/admin/list-view/StatusPill"

type JobCounts = { pending: number; processing: number; completed: number; failed: number; stale: number }
type JobType = { type: string; label: string }

type JobRow = {
  id: string
  status: string
  isStale: boolean
  attempts: number
  maxAttempts: number
  availableAt: string
  lockedAt: string | null
  lockedBy: string | null
  lastError: string | null
  createdAt: string
  completedAt: string | null
  description: string | null
}

function fmt(d: string | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

export function QueueDashboard() {
  const [types, setTypes] = useState<JobType[]>([])
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [counts, setCounts] = useState<JobCounts | null>(null)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)

  const loadTypes = useCallback(async () => {
    const res = await fetch("/api/admin/queue")
    if (!res.ok) return
    const data = (await res.json()) as { types: JobType[] }
    setTypes(data.types)
    setSelectedType((current) => current ?? data.types[0]?.type ?? null)
  }, [])

  const loadSelected = useCallback(async (type: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/queue?type=${encodeURIComponent(type)}`)
      if (!res.ok) return
      const data = (await res.json()) as { counts: JobCounts; jobs: JobRow[] }
      setCounts(data.counts)
      setJobs(data.jobs)
    } catch {
      // keep last known state on transient fetch errors
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(loadTypes)
  }, [loadTypes])

  useEffect(() => {
    if (selectedType) queueMicrotask(() => loadSelected(selectedType))
  }, [selectedType, loadSelected])

  async function retry() {
    if (!selectedType) return
    setRetrying(true)
    try {
      const res = await fetch("/api/admin/queue/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedType }),
      })
      const data = (await res.json()) as { success: true; batches: number } | { error: string }
      if (!res.ok || "error" in data) {
        toast.error("error" in data ? data.error : "Retry failed")
      } else {
        toast.success(
          data.batches > 0
            ? `Processed ${data.batches} batch${data.batches === 1 ? "" : "es"}`
            : "Nothing to process — queue is already clear",
        )
      }
    } catch {
      toast.error("Retry failed unexpectedly")
    } finally {
      setRetrying(false)
      loadTypes()
      if (selectedType) loadSelected(selectedType)
    }
  }

  const staleCount = counts?.stale ?? 0

  if (types.length === 0) {
    return (
      <div className="lv-card" style={{ marginTop: 20, padding: 18 }}>
        <p style={{ fontSize: 12.5, color: "var(--lv-text-3)", margin: 0 }}>No job types registered yet.</p>
      </div>
    )
  }

  return (
    <div className="lv-card" style={{ marginTop: 20, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <select
          value={selectedType ?? ""}
          onChange={(e) => setSelectedType(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--lv-border)", fontSize: 13, fontWeight: 600 }}
        >
          {types.map((t) => (
            <option key={t.type} value={t.type}>{t.label}</option>
          ))}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" onClick={() => selectedType && loadSelected(selectedType)} disabled={loading} style={secondaryButtonStyle}>
            <RefreshCw style={{ width: 13, height: 13 }} />
            Refresh
          </button>
          <button type="button" onClick={retry} disabled={retrying || !selectedType} style={retryButtonStyle(staleCount > 0)}>
            <AlertTriangle style={{ width: 13, height: 13 }} />
            {retrying ? "Retrying…" : "Retry stuck jobs"}
          </button>
        </div>
      </div>

      {counts && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <StatChip label="Pending" value={counts.pending} />
          <StatChip label="Processing" value={counts.processing} />
          <StatChip label="Stale" value={counts.stale} tone={counts.stale > 0 ? "danger" : undefined} />
          <StatChip label="Completed" value={counts.completed} tone="good" />
          <StatChip label="Failed" value={counts.failed} tone={counts.failed > 0 ? "danger" : undefined} />
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--lv-text-3)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              <th style={thStyle}>Job</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Attempts</th>
              <th style={thStyle}>Locked</th>
              <th style={thStyle}>Created</th>
              <th style={thStyle}>Completed</th>
              <th style={thStyle}>Last error</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && !loading && (
              <tr>
                <td colSpan={7} style={{ padding: "18px 8px", textAlign: "center", color: "var(--lv-text-3)" }}>No jobs yet.</td>
              </tr>
            )}
            {jobs.map((j) => (
              <tr key={j.id} style={{ borderTop: "1px solid var(--lv-border)" }}>
                <td style={tdStyle}>{j.description ?? j.id}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <StatusPill status={j.status} />
                    {j.isStale && <span style={staleTagStyle}>STALE</span>}
                  </div>
                </td>
                <td style={tdStyle}>{j.attempts} / {j.maxAttempts}</td>
                <td style={tdStyle}>{fmt(j.lockedAt)}</td>
                <td style={tdStyle}>{fmt(j.createdAt)}</td>
                <td style={tdStyle}>{fmt(j.completedAt)}</td>
                <td
                  style={{ ...tdStyle, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: j.lastError ? "var(--lv-danger)" : undefined }}
                  title={j.lastError ?? undefined}
                >
                  {j.lastError ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatChip({ label, value, tone }: { label: string; value: number; tone?: "good" | "danger" }) {
  const color = tone === "danger" ? "#B91C1C" : tone === "good" ? "#047857" : "var(--lv-text)"
  const bg = tone === "danger" ? "#FEF2F2" : tone === "good" ? "#ECFDF5" : "var(--lv-panel-2)"
  return (
    <div style={{ padding: "8px 14px", borderRadius: 10, background: bg, minWidth: 84 }}>
      <div style={{ fontSize: 11, color: "var(--lv-text-3)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value.toLocaleString()}</div>
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: "6px 8px" }
const tdStyle: React.CSSProperties = { padding: "8px 8px", color: "var(--lv-text)" }
const staleTagStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", color: "#B91C1C",
  background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 999, padding: "2px 6px",
}
const secondaryButtonStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
  border: "1px solid var(--lv-border)", background: "#fff", color: "var(--lv-text-2)",
  fontWeight: 600, fontSize: 12.5, cursor: "pointer",
}
function retryButtonStyle(hasStale: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
    border: `1.5px solid ${hasStale ? "var(--lv-danger)" : "var(--lv-border)"}`,
    background: hasStale ? "#FEF2F2" : "#fff", color: hasStale ? "#B91C1C" : "var(--lv-text-2)",
    fontWeight: 600, fontSize: 12.5, cursor: "pointer",
  }
}
```

- [ ] **Step 4: Write `app/admin/queue/page.tsx`**

```tsx
// app/admin/queue/page.tsx
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { FadeUp } from "@/components/admin/motion"
import { QueueDashboard } from "@/components/admin/queue/QueueDashboard"

export default async function AdminQueuePage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.QUEUE_MANAGEMENT)

  return (
    <FadeUp>
      <div className="py-2">
        <div className="lv-pagehead">
          <div>
            <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
              <Link href="/admin">Admin</Link>
              <ChevronRight />
              <span className="lv-here">Queue</span>
            </nav>
            <h1 className="lv-h1">Queue</h1>
            <p className="lv-subhead">Background job queue health across every feature that uses it.</p>
          </div>
        </div>

        <QueueDashboard />
      </div>
    </FadeUp>
  )
}
```

- [ ] **Step 5: Add the "Queue" nav entry to `AdminSidebar.tsx`**

Add `ListChecks` to the `lucide-react` import list (alongside `ShieldCheck`). Append a new group to the end of the `navGroups` array literal (after the `"Settings"` group, before its closing `];`):

```ts
  {
    label: "System",
    items: [
      {
        href: "/admin/queue",
        label: "Queue",
        icon: ListChecks,
        color: "#0891b2",
        featureKey: FEATURE_KEYS.QUEUE_MANAGEMENT,
        isActive: (p) => p.startsWith("/admin/queue"),
      },
    ],
  },
];
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:component -- queue-dashboard.test.tsx admin-sidebar-queue.test.tsx`
Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22 && \
git add app/admin/queue components/admin/queue components/admin/AdminSidebar.tsx \
  tests/component/queue-dashboard.test.tsx tests/component/admin-sidebar-queue.test.tsx && \
git commit -m "$(cat <<'EOF'
Add unified /admin/queue page and sidebar nav entry

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Remove the old Surprise Bonus panel and its dedicated routes

**Files:**
- Delete: `features/points/components/SurpriseBonusJobsPanel.tsx`
- Delete: `app/api/admin/points/surprise-bonus/jobs/route.ts`
- Delete: `app/api/admin/points/surprise-bonus/jobs/retry/route.ts`
- Delete: `tests/api/admin/surprise-bonus-jobs.test.ts`
- Delete: `tests/unit/surprise-bonus-jobs-db.test.ts`
- Modify: `app/admin/credit/transactions/page.tsx`
- Modify: `docs/technical/surprise-bonus-jobs-panel.md`

**Interfaces:**
- Consumes: nothing new (this task only removes superseded code).
- Produces: nothing new — `/admin/queue` (Task 9) is now the only queue-visibility surface for Surprise Bonus.

- [ ] **Step 1: Delete the superseded files**

```bash
rm features/points/components/SurpriseBonusJobsPanel.tsx
rm app/api/admin/points/surprise-bonus/jobs/route.ts
rm app/api/admin/points/surprise-bonus/jobs/retry/route.ts
rmdir app/api/admin/points/surprise-bonus/jobs/retry app/api/admin/points/surprise-bonus/jobs 2>/dev/null || true
rm tests/api/admin/surprise-bonus-jobs.test.ts
rm tests/unit/surprise-bonus-jobs-db.test.ts
```

- [ ] **Step 2: Remove the panel embed from the transactions page**

In `app/admin/credit/transactions/page.tsx`, delete this import line:

```ts
import { SurpriseBonusJobsPanel } from "@/features/points/components/SurpriseBonusJobsPanel"
```

and delete this JSX usage (currently right after `<PointTransactionsTable .../>`):

```tsx
      <SurpriseBonusJobsPanel />
```

- [ ] **Step 3: Add an "Update" note to the superseded panel doc**

In `docs/technical/surprise-bonus-jobs-panel.md`, insert this block right after the `# Surprise Bonus — Background Jobs admin panel` title line:

```markdown

> **Update (later cleanup):** this dedicated panel and its two routes
> (`app/api/admin/points/surprise-bonus/jobs/route.ts`,
> `.../jobs/retry/route.ts`) have been removed. Queue visibility for
> Surprise Bonus — and every other queue-backed feature — now lives on the
> unified `/admin/queue` page; see
> [queue-management.md](./queue-management.md). The mechanics described
> below (status counts, `isStale` computation, "Retry stuck jobs" running a
> real drain pass) are unchanged, just generalized and moved.
```

- [ ] **Step 4: Confirm no dangling references remain**

Run: `grep -rn "SurpriseBonusJobsPanel\|surprise-bonus/jobs" app/ features/ --include="*.ts" --include="*.tsx"`
Expected: no output.

- [ ] **Step 5: Run the full test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22 && \
git add -A app/api/admin/points/surprise-bonus/jobs features/points/components/SurpriseBonusJobsPanel.tsx \
  tests/api/admin/surprise-bonus-jobs.test.ts tests/unit/surprise-bonus-jobs-db.test.ts \
  app/admin/credit/transactions/page.tsx docs/technical/surprise-bonus-jobs-panel.md && \
git commit -m "$(cat <<'EOF'
Remove the embedded Surprise Bonus jobs panel, superseded by /admin/queue

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Documentation

**Files:**
- Create: `docs/technical/queue-management.md`
- Create: `docs/guides/queue-management.md`
- Create: `docs/api/admin-queue.md`
- Modify: `docs/technical/surprise-bonus-queue.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Write `docs/technical/queue-management.md`**

```markdown
# Queue Management — lib/queue

## What changed

Extracted the generic parts of the Surprise Bonus background-job queue
(`background_jobs` table + `claim_background_job` RPC, both already
type-agnostic) into a reusable `lib/queue/` module, so any feature can
enqueue and drain jobs without re-implementing claim/retry/backoff/admin
visibility. Surprise Bonus itself was refactored onto it with full
functional parity (see `docs/technical/surprise-bonus-queue.md`).

| Path | Role |
|------|------|
| `drizzle/schema/queue-schema.ts` | `backgroundJobs` table (moved from `surprise-bonus-schema.ts`, same underlying `background_jobs` table, no migration) |
| `lib/queue/types.ts` | `QueueJobPayload`, `ClaimedQueueJob`, `QueueJobHandler`, `QueueJobRow`, `QueueJobStatusCounts`, `QueueJobDefinition` |
| `lib/queue/queue.ts` | `enqueueJob`, `claimJob`, `completeJob`, `failOrRetryJob`, `listJobs`, `getJobStatusCounts`, `normalizeRows`, `STALE_AFTER_MS` |
| `lib/queue/drain.ts` | `drainJobs` — claim/handle/complete loop |
| `lib/queue/registry.ts` | `registerQueueJob`, `getQueueJobDefinition`, `listRegisteredJobTypes` — in-code registry, not DB-backed |
| `lib/queue/registrations.ts` | Side-effect-only module importing every feature's registration file |
| `app/api/admin/queue/route.ts` | `GET` — status counts (all types, or one type + its job list) |
| `app/api/admin/queue/retry/route.ts` | `POST { type }` — one drain pass for that type |
| `app/admin/queue/page.tsx`, `components/admin/queue/QueueDashboard.tsx` | Unified admin queue-health page |

## Data flow

**Enqueue + inline drain (how every current consumer uses it):**
```
Feature code
  → enqueueJob(type, payload)              // INSERT background_jobs, status=pending
  → drainJobs(type, handler, { maxBatches })
      → claimJob(type, lockedBy)           // claim_background_job RPC, FOR UPDATE SKIP LOCKED
      → handler(job)                       // feature-specific business logic
      → completeJob(job.id)                // on success
      → on throw: failOrRetryJob(job, message); rethrow — aborts the drain
  → caller decides what a thrown drain error means for its own response
```

**Admin visibility:**
```
/admin/queue mounts → GET /api/admin/queue
  → listRegisteredJobTypes() + getJobStatusCounts(type) per type
Admin selects a type → GET /api/admin/queue?type=<type>
  → getJobStatusCounts(type) + listJobs(type) (+ that type's describeJobs, if any)
Admin clicks "Retry stuck jobs" → POST /api/admin/queue/retry { type }
  → drainJobs(type, definition.handler, { maxBatches: 50 })
```

## Schema impact

None beyond the code move — `background_jobs` (table name, columns, indexes)
is unchanged; `claim_background_job` RPC is unchanged. No new migration.

## Auth & permissions

`GET`/`POST` on `/api/admin/queue*`: `requireAdminOrFeature(request, FEATURE_KEYS.QUEUE_MANAGEMENT)`.
Page: `requireFeatureAccess(FEATURE_KEYS.QUEUE_MANAGEMENT)`. Admin role
always passes; internal staff need the `queue_management` permission
granted via the RBAC permissions UI.

## Edge cases & known limitations

- No cron. A job only drains when a feature calls `drainJobs` itself
  (typically right after `enqueueJob`, inline in the same request) or an
  admin clicks "Retry stuck jobs" on `/admin/queue`.
- `drainJobs` aborts the whole drain on the first handler error (after
  recording it via `failOrRetryJob`) rather than continuing to the next
  job — intentional, matches the pre-existing Surprise Bonus drain
  behavior exactly, since a caller like `enqueueSurpriseBonusForAllUsers`
  depends on the throw to report failure to its own caller.
- `describeJobs` is a per-request batch enrichment hook, not stored — it
  must do its own single batched lookup (not one query per job) to avoid
  N+1 queries when the admin panel lists many jobs.
- The in-code registry (`lib/queue/registry.ts`) only knows about types
  whose registration module has actually been imported in the current
  request's module graph — see `docs/guides/queue-management.md` for how
  to wire a new type into `lib/queue/registrations.ts`.
```

- [ ] **Step 2: Write `docs/guides/queue-management.md`**

```markdown
# Queue Management — Collaborator Guide

## Prerequisites

Nothing extra — `lib/queue` reuses the existing `background_jobs` table and
`claim_background_job` Postgres function. No new env vars, no new
dependencies.

## Adding a new job type

1. **Write a handler.** A handler receives one claimed job and does the
   work; return normally on success, throw on failure (the queue records
   the failure and retries with backoff, or marks the job `failed` once
   `maxAttempts` is reached).

   ```ts
   // features/my-feature/services/process-my-jobs.ts
   import type { ClaimedQueueJob } from "@/lib/queue/types"
   import { registerQueueJob } from "@/lib/queue/registry"

   export const MY_JOB_TYPE = "my_feature_batch" as const

   type MyJobPayload = { someId: string }

   // ClaimedQueueJob is intentionally not generic (see lib/queue/types.ts) —
   // cast payload to your feature's shape inside the handler.
   export async function processMyJob(job: ClaimedQueueJob): Promise<void> {
     const payload = job.payload as MyJobPayload
     // ... do the work for payload.someId ...
   }

   registerQueueJob({
     type: MY_JOB_TYPE,
     label: "My Feature",
     handler: processMyJob,
   })
   ```

2. **Wire the registration into the shared registry** by adding an import
   to `lib/queue/registrations.ts`:

   ```ts
   import "@/features/my-feature/services/process-my-jobs"
   ```

   Both admin routes (`app/api/admin/queue/*`) import this file, so your
   type automatically shows up on `/admin/queue` once this line exists.

3. **Enqueue and drain** from wherever your feature creates the work
   (typically inline, right after creating whatever record the job is
   about):

   ```ts
   import { enqueueJob } from "@/lib/queue/queue"
   import { drainJobs } from "@/lib/queue/drain"
   import { MY_JOB_TYPE, processMyJob } from "@/features/my-feature/services/process-my-jobs"

   await enqueueJob(MY_JOB_TYPE, { someId: record.id })
   await drainJobs(MY_JOB_TYPE, processMyJob, { maxBatches: 10 })
   ```

   There is no cron — if you enqueue from somewhere other than an
   admin-triggered request, your feature is responsible for draining it
   (inline, or the admin can always fall back to clicking "Retry stuck
   jobs" on `/admin/queue`).

## Showing more than a raw job id on `/admin/queue`

Add an optional `describeJobs` to your `registerQueueJob` call — one
batched lookup for the whole listed page, not a per-row query:

```ts
registerQueueJob({
  type: MY_JOB_TYPE,
  label: "My Feature",
  handler: processMyJob,
  describeJobs: async (jobs) => {
    const ids = [...new Set(jobs.map((j) => (j.payload as MyJobPayload).someId))]
    const rows = await db.select(/* ... */).from(myTable).where(inArray(myTable.id, ids))
    const result = new Map<string, string>()
    for (const job of jobs) {
      const row = rows.find((r) => r.id === (job.payload as MyJobPayload).someId)
      if (row) result.set(job.id, row.someLabel)
    }
    return result
  },
})
```

## Common errors

| Symptom | Cause | Fix |
|---|---|---|
| A job type never appears on `/admin/queue` | Its registration module isn't imported by `lib/queue/registrations.ts` | Add the import |
| A job is stuck `processing` forever | The process that claimed it crashed mid-handler with no thrown JS exception (e.g. a serverless timeout) | `claim_background_job` reclaims any `processing` job locked >3 minutes — the next `drainJobs` call (inline or via "Retry stuck jobs") picks it back up automatically |
| `/admin/queue` returns 403 for an internal staff member | They lack the `queue_management` RBAC permission | Grant it via the admin permissions UI (System group) |
| Draining one type's stuck job also fails other independent jobs of the same type in the same drain call | `drainJobs` aborts the whole drain on the first thrown error, by design (see the technical doc) | Click "Retry stuck jobs" again — the failed job is either backed off or already marked `failed`, and the next call will reach the others |
```

- [ ] **Step 3: Write `docs/api/admin-queue.md`**

```markdown
# GET/POST /api/admin/queue

## GET /api/admin/queue

**Auth:** Admin session, or internal session with the `queue_management` RBAC permission (`requireAdminOrFeature`).

**Query params:** `type` (optional) — a registered job type's identifier.

**Response — no `type`:**
```json
{
  "types": [
    { "type": "surprise_bonus_batch", "label": "Surprise Bonus", "counts": { "pending": 1, "processing": 0, "completed": 40, "failed": 0, "stale": 0 } }
  ]
}
```

**Response — with `type`:**
```json
{
  "types": [{ "type": "surprise_bonus_batch", "label": "Surprise Bonus" }],
  "selectedType": "surprise_bonus_batch",
  "counts": { "pending": 1, "processing": 0, "completed": 40, "failed": 0, "stale": 0 },
  "jobs": [
    {
      "id": "job-1",
      "status": "processing",
      "isStale": true,
      "attempts": 1,
      "maxAttempts": 5,
      "availableAt": "2026-09-08T09:59:00.000Z",
      "lockedAt": "2026-09-08T10:00:00.000Z",
      "lockedBy": "local-abc123",
      "lastError": null,
      "createdAt": "2026-09-08T09:58:00.000Z",
      "completedAt": null,
      "description": "Sweet December"
    }
  ]
}
```

**Errors:** `401` unauthorized, `403` forbidden, `404` unknown `type`.

**Example:**
```bash
curl -H "Cookie: better-auth.session_token=..." \
  "https://<host>/api/admin/queue?type=surprise_bonus_batch"
```

**Mobile flag:** not used by the mobile app — admin-only.

## POST /api/admin/queue/retry

**Auth:** same as `GET`.

**Body:**
```json
{ "type": "surprise_bonus_batch" }
```

**Response (200):**
```json
{ "success": true, "batches": 2 }
```

**Errors:** `400` missing `type`, `401` unauthorized, `403` forbidden, `404` unknown `type`, `500` when the drain throws (`{ "error": "Retry failed: <message>" }`).

**Example:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=..." \
  -d '{"type":"surprise_bonus_batch"}' \
  "https://<host>/api/admin/queue/retry"
```

**Mobile flag:** not used by the mobile app — admin-only.
```

- [ ] **Step 4: Update `docs/technical/surprise-bonus-queue.md`**

Replace the file table (the block starting at `| Path | Role |` through the `PointActionButtons.tsx` row) with:

```markdown
| Path | Role |
|------|------|
| `drizzle/schema/surprise-bonus-schema.ts` | `surprise_bonus_campaign`, `app_notification`, `SURPRISE_BONUS_JOB_TYPE` |
| `drizzle/schema/queue-schema.ts` | `background_jobs` — generic queue table, shared with any other lib/queue consumer |
| `drizzle/migrations/0081_surprise_bonus_queue.sql` | Tables, unique ledger index, RPCs |
| `drizzle/migrations/0087_reclaim_stale_surprise_bonus_jobs.sql` | `claim_background_job` also reclaims stale `processing` jobs |
| `lib/queue/` | Generic claim/retry/drain/admin-listing core — see [queue-management.md](./queue-management.md) |
| `features/points/db/surprise-bonus.ts` | Create campaign / progress / `describeSurpriseBonusJobs` (admin panel enrichment) |
| `features/points/services/enqueue-surprise-bonus.ts` | Orchestration; always drains inline via `lib/queue` |
| `features/points/services/process-surprise-bonus-jobs.ts` | `processSurpriseBonusJob` — the registered `lib/queue` handler for `SURPRISE_BONUS_JOB_TYPE` |
| `features/points/services/surprise-bonus-push.ts` | FCM payload + send to user devices |
| `app/api/admin/points/surprise-bonus/route.ts` | `POST` create + drain (`maxDuration = 60`) |
| `app/api/admin/points/surprise-bonus/[id]/route.ts` | `GET` — audit a past campaign's counts (not used for polling) |
| `app/api/cron/surprise-bonus-push/route.ts` | FCM proxy for the optional Supabase Edge Function path (`CRON_SECRET`) |
| `supabase/functions/process-background-jobs/index.ts` | **Optional** standalone worker — not required, most deployments don't run it |
| `features/points/components/PointActionButtons.tsx` | All Users → POST, shows the completed result |

Queue visibility (status counts, recent jobs, "Retry stuck jobs") moved
from a dedicated embedded panel to the unified
[`/admin/queue`](../guides/queue-management.md) page — see
[surprise-bonus-jobs-panel.md](./surprise-bonus-jobs-panel.md) for the
superseded version.
```

- [ ] **Step 5: Commit**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22 && \
git add docs/technical/queue-management.md docs/guides/queue-management.md \
  docs/api/admin-queue.md docs/technical/surprise-bonus-queue.md && \
git commit -m "$(cat <<'EOF'
Document lib/queue: architecture, collaborator guide, API reference

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Full verification

**Files:** none (verification only; fix forward in the relevant task's files if something fails).

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (unit, api, integration, component).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Manual browser verification**

Per this project's UI-verification convention, use the `agent-skills:browser-testing-with-devtools` skill against a locally running dev server (`nvm use 22 && npm run dev`):

1. Sign in as an admin (see `docs/guides/admin-top-up.md` / seed admin credentials) and navigate to `/admin/queue`.
2. Confirm the page loads, shows "Surprise Bonus" in the type dropdown, and renders status counts (pending/processing/stale/completed/failed chips).
3. Trigger a Surprise Bonus Top-up from `/admin/credit/transactions` (small test amount), then return to `/admin/queue` and confirm the campaign's job appears with status `completed` and the campaign name under "Job".
4. Click "Retry stuck jobs" with no stuck jobs present and confirm the toast reads "Nothing to process — queue is already clear" and no error is thrown.
5. Navigate to `/admin/credit/transactions` and confirm the old embedded panel is gone (no "Surprise Bonus — Background Jobs" heading on that page).
6. Check the browser console and network tab for errors on both pages.

- [ ] **Step 5: Report results**

If any step in this task fails, return to the task that owns the broken file, fix it there (not by patching around it here), rerun that task's own test command, then rerun this task's Step 1.
