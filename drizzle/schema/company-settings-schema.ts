import { sql } from "drizzle-orm"
import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { user } from "./auth-schema"

export const companySetting = pgTable("company_setting", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  /** The user account that represents the company as a seller on own products. */
  companyUserId: text("company_user_id").references(() => user.id, { onDelete: "set null" }),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
