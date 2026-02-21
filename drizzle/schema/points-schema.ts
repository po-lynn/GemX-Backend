import { pgTable, text, integer } from "drizzle-orm/pg-core";

/**
 * Key-value store for points-related settings.
 * Keys:
 * - "default_registration_points" -> value: initial points for new users.
 * - "earning_points_rate_mmk" -> value: points per 1 MMK.
 * - "earning_points_rate_usd" -> value: points per 1 USD.
 * - "earning_points_rate_krw" -> value: points per 1 KRW.
 */
export const pointSetting = pgTable("point_setting", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
});
