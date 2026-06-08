import { pgTable, text, boolean } from "drizzle-orm/pg-core"

export const supervisorPermission = pgTable("supervisor_permission", {
  featureKey: text("feature_key").primaryKey(),
  canAccess:  boolean("can_access").notNull().default(false),
})
