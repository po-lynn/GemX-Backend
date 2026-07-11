import { boolean, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

/** Which content area a row represents. Exactly one row per value, enforced by the unique constraint on `section`. */
export const appContentSectionEnum = pgEnum("app_content_section_name", [
  "about_us",
  "follow_us",
  "help_support",
])

/**
 * Draft/published content versioning for the About Us / Follow Us / Help & Support
 * admin page. `draftContent` is what the admin edits; `publishedContent` is what
 * the mobile app reads. Publish copies draft -> published and clears the dirty flag.
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
})
