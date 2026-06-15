import { pgTable, text, boolean, primaryKey } from "drizzle-orm/pg-core"

export const internalPermission = pgTable("internal_permission", {
  userId:     text("user_id").notNull(),
  featureKey: text("feature_key").notNull(),
  canAccess:  boolean("can_access").notNull().default(false),
}, (table) => [
  primaryKey({ columns: [table.userId, table.featureKey] }),
])
