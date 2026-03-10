import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * FCM (or other) device tokens for push notifications to mobile app users.
 * Mobile app registers via POST /api/push/register after login.
 */
export const pushDeviceToken = pgTable(
  "push_device_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform"), // "android" | "ios" | null
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("push_device_token_user_token_idx").on(table.userId, table.token)]
);
