import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

/** Severity level of a precaution advisory shown to buyers. */
export const precautionTagSeverityEnum = pgEnum("precaution_tag_severity", ["critical", "warning", "info"])

/** Which product certification context the precaution applies to. */
export const precautionTagAppliesToEnum = pgEnum("precaution_tag_applies_to", ["certified", "non_certified", "both"])

/**
 * Admin-managed safety advisories shown to buyers before they chat, call or pay.
 * Certified and non-certified gemstones surface different precautions.
 * `is_active` hides a tag from buyers without deleting historical rows.
 */
export const precautionTag = pgTable("precaution_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  severity: precautionTagSeverityEnum("severity").notNull(),
  appliesTo: precautionTagAppliesToEnum("applies_to").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
