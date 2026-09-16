import { boolean, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { user } from "./auth-schema"

// Named "staff_role_type", not "staff_role": Postgres gives every table an implicit
// composite row type sharing the table's name, which would collide with an enum
// pg_type of the identical name in the same schema (see e.g. productStatusEnum's
// "product_status" vs. the "product" table for the established naming split).
export const staffRoleEnum = pgEnum("staff_role_type", ["escrow_agent", "moderator", "support", "analyst"])

/**
 * A dedicated staff designation layered on top of `user.role = "internal"`, not a new
 * `role` value. `role` is unconstrained free text with no DB enum (dropped in migration
 * 0033) and is checked by ~7 hardcoded call sites across the app (lib/api-guard.ts,
 * lib/admin-guard.ts, proxy.ts, etc.) — adding a role value here was tried and reverted
 * twice before (commits 35129e7, 8a78eec). A row here is purely an identity/assignment
 * concept; page access is still gated by the existing internal_permission feature-key
 * system (see FEATURE_KEYS.ESCROW_CASES / CHAT_MODERATION). Absence of a row means
 * "plain internal staff" — today's status quo, fully backward compatible.
 */
export const staffRole = pgTable("staff_role", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  role: staffRoleEnum("role").notNull(),
  // Only meaningful when role = "escrow_agent": lets the holder reassign any case and
  // see every agent's inbox, not just their own. Enforced at the app layer on write.
  isSupervisor: boolean("is_supervisor").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}).enableRLS()
