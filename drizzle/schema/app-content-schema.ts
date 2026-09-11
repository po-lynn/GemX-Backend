import { boolean, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

/** Which content area a row represents. Exactly one row per value, enforced by the unique constraint on `section`. */
export const appContentSectionEnum = pgEnum("app_content_section_name", [
  "about_us",
  "follow_us",
  "help_support",
  "terms_conditions",
  "buying_guide",
  "selling_guide",
])

/**
 * Draft/published content for About Us / Follow Us / Help & Support /
 * Terms & Conditions / Buying Guide / Selling Guide.
 * Save writes both draft and published; mobile reads published.
 */
export const appContentSection = pgTable("app_content_section", {
  id: uuid("id").primaryKey().defaultRandom(),
  section: appContentSectionEnum("section").notNull().unique(),
  draftContent: jsonb("draft_content").notNull(),
  publishedContent: jsonb("published_content"),
  hasUnpublishedChanges: boolean("has_unpublished_changes").notNull().default(false),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  updatedByName: text("updated_by_name"),
  publishedAt: timestamp("published_at"),
  publishedByName: text("published_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}).enableRLS()
