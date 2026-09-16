import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth-schema"

/**
 * Editable reply templates for escrow agents. Fixed English/Burmese columns (not a
 * translation-key catalog) to match this repo's existing i18n convention for
 * user-facing content — see product/news `titleEn`/`titleMy`-style columns.
 */
export const escrowCannedResponse = pgTable("escrow_canned_response", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  bodyEn: text("body_en").notNull(),
  bodyMy: text("body_my").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdByAdminId: text("created_by_admin_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}).enableRLS()
