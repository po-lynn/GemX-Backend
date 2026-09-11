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
    /** Structured outcome a handler returns on success (e.g. { credited: 48, failed: 2 }) — surfaced in the admin panel's expandable row detail. */
    result: jsonb("result").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("bj_status_available_idx").on(table.status, table.availableAt),
    index("bj_type_status_idx").on(table.type, table.status),
  ],
).enableRLS()
