import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

/** Sentiment bucket for preset tags buyers attach to seller ratings. */
export const ratingTagTypeEnum = pgEnum("rating_tag_type", ["positive", "negative"])

/**
 * Admin-managed tags for seller ratings (e.g. “Fast shipping”).
 * `is_active` hides options from apps without deleting historical rows.
 */
export const ratingTag = pgTable("rating_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: ratingTagTypeEnum("type").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
