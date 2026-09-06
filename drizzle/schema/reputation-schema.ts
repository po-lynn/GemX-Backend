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
}).enableRLS()

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
    // Nullable + "set null" (not "cascade"): deleting an admin user must never
    // destroy this append-only audit trail. A cascade here would delete the
    // `dismissed` rows that suppress a recomputed case, silently reopening
    // cases that were already decided. New rows always carry a real admin id —
    // only historical rows can end up null after that admin is deleted.
    adminUserId: text("admin_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("seller_reputation_action_seller_user_id_idx").on(table.sellerUserId),
    index("seller_reputation_action_seller_trigger_idx").on(table.sellerUserId, table.triggerKey),
    index("seller_reputation_action_created_at_idx").on(table.createdAt),
  ]
).enableRLS()

/** Current archive state — one row per seller that has ever been archived. */
export const sellerArchive = pgTable(
  "seller_archive",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sellerUserId: text("seller_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    // Nullable + "set null" (matches restoredByAdminId below): a cascade here
    // would delete the whole archive row when the archiving admin is deleted,
    // which drops the `restoredAt IS NULL` exclusion in computeCaseSummaries
    // and makes the seller silently reappear as an open case with no record of
    // ever having been archived.
    archivedByAdminId: text("archived_by_admin_id").references(() => user.id, { onDelete: "set null" }),
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
).enableRLS()
