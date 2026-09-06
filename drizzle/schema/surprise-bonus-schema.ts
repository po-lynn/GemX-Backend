import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { user } from "./auth-schema"

/** Job type claimed by process-background-jobs Edge Function. */
export const SURPRISE_BONUS_JOB_TYPE = "surprise_bonus_batch" as const

/**
 * One-time admin Surprise Bonus campaign (All Users).
 * Processed asynchronously via background_jobs + Edge Function batches.
 */
export const surpriseBonusCampaign = pgTable(
  "surprise_bonus_campaign",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    pointsPerUser: integer("points_per_user").notNull(),
    recipientType: text("recipient_type").notNull().default("all_users"),
    note: text("note"),
    totalUsers: integer("total_users").notNull().default(0),
    processedUsers: integer("processed_users").notNull().default(0),
    successCount: integer("success_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    /** pending | processing | completed | failed */
    status: text("status").notNull().default("pending"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("sbc_status_idx").on(table.status),
    index("sbc_createdAt_idx").on(table.createdAt),
  ],
).enableRLS()

/**
 * Database-backed job queue (no Redis). Claimed with FOR UPDATE SKIP LOCKED via RPC.
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

/**
 * In-app system notifications (not chat). Used for surprise_bonus and future types.
 */
export const appNotification = pgTable(
  "app_notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    data: jsonb("data").$type<Record<string, unknown> | null>(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("an_userId_createdAt_idx").on(table.userId, table.createdAt),
    index("an_userId_isRead_idx").on(table.userId, table.isRead),
  ],
).enableRLS()

/** Partial unique: one ledger row per (user, type, reference) when reference is set. */
export const pointTransactionUserTypeRefUnique = sql`
  CREATE UNIQUE INDEX IF NOT EXISTS pt_user_type_ref_uidx
  ON point_transaction (user_id, type, reference_id)
  WHERE reference_id IS NOT NULL
`
