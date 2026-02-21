import { pgTable, text, integer } from "drizzle-orm/pg-core";

/**
 * Key-value store for points-related settings.
 * value: integer for numeric settings; value_text: optional string (e.g. bonus description).
 * Keys: default_registration_points, registration_bonus_enabled (0/1),
 * earning_*_amount, earning_*_points (MMK, USD, KRW), registration_bonus_description (value_text),
 * minimum_spend_amount, minimum_spend_currency (0=MMK,1=USD,2=KRW),
 * rounding_method (0=down,1=up,2=nearest), point_expiry_days.
 */
export const pointSetting = pgTable("point_setting", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
  valueText: text("value_text"),
});
