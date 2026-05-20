import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * FCM device registrations per user. Supports multiple devices per account.
 * Mobile registers via login/register body or POST /api/push/register.
 */
export const userDevice = pgTable(
  "user_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fcmToken: text("fcm_token").notNull(),
    platform: text("platform"), // "android" | "ios"
    deviceId: text("device_id"),
    deviceName: text("device_name"),
    deviceModel: text("device_model"),
    osVersion: text("os_version"),
    appVersion: text("app_version"),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_devices_user_fcm_token_idx").on(table.userId, table.fcmToken),
    uniqueIndex("user_devices_fcm_token_idx").on(table.fcmToken),
  ]
);
