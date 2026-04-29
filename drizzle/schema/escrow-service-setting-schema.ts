import { sql } from "drizzle-orm"
import { pgTable, text, timestamp, numeric, index } from "drizzle-orm/pg-core"
import { user } from "./auth-schema"

/**
 * Escrow service landing/contact settings used by admin-managed configuration.
 * Escrow-specific content (fee + overview) is stored here.
 */
export const escrowServiceSetting = pgTable(
  "escrow_service_setting",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    /** Selected escrow service admin user. */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /** Percent value (e.g. 2.50 means 2.5%). */
    serviceFee: numeric("service_fee", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    serviceOverview: text("service_overview").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("escrow_service_setting_user_id_idx").on(table.userId)]
)

