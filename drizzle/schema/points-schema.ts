import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * Key-value store for points-related settings.
 * value: integer for numeric settings; value_text: optional string (e.g. bonus description).
 * Keys: default_registration_points, registration_bonus_enabled (0/1),
 * earning_*_amount, earning_*_points (MMK, USD, KRW), registration_bonus_description (value_text),
 * minimum_spend_amount, minimum_spend_currency (0=MMK,1=USD,2=KRW),
 * rounding_method (0=down,1=up,2=nearest), point_expiry_days,
 * featured_product_home_limit (value), feature_pricing_tiers_json (value_text JSON array),
 * premium_dealers_packages_json (value_text JSON array of premium dealer packages).
 */
export const pointSetting = pgTable("point_setting", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
  valueText: text("value_text"),
});

/**
 * Tracks customer requests to purchase credit point packages via KBZ Pay.
 * Flow: customer submits request → admin verifies KBZ Pay transfer → admin approves/rejects → on approval, points are credited.
 * status: "pending" | "approved" | "rejected"
 */
export const pointPurchaseRequest = pgTable(
  "point_purchase_request",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    packageName: text("package_name").notNull(),
    points: integer("points").notNull(),
    /** Amount charged in the selected currency */
    price: integer("price").notNull(),
    /** Currency of the payment, e.g. "mmk", "usd", "krw" */
    currency: text("currency").notNull().default("mmk"),
    /** Payment method name from settings (e.g. "KBZ Pay") */
    paymentMethod: text("payment_method"),
    status: text("status").notNull().default("pending"),
    /** Amount the customer claims to have transferred (in the selected currency) */
    transferredAmount: integer("transferred_amount"),
    /** Name the customer used on the transfer */
    transferredName: text("transferred_name"),
    /** Transaction reference / receipt number from the transfer */
    transactionReference: text("transaction_reference"),
    /** Optional extra note from customer */
    transferNote: text("transfer_note"),
    /** Admin note on approval or rejection */
    adminNote: text("admin_note"),
    reviewedByAdminId: text("reviewed_by_admin_id"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ppr_userId_idx").on(table.userId),
    index("ppr_status_idx").on(table.status),
  ]
);

/**
 * Unified ledger of all point movements per user.
 * type: "topup" | "premium_activation" | "feature_activation" | "registration_bonus" | "admin_adjustment"
 * direction: "credit" | "debit"
 * status: "completed" | "pending" | "cancelled" | "rejected"
 * referenceType: "purchase_request" | "premium_package" | "product" | "registration"
 */
export const pointTransaction = pgTable(
  "point_transaction",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    direction: text("direction").notNull(),
    amount: integer("amount").notNull(),
    status: text("status").notNull(),
    referenceId: text("reference_id"),
    referenceType: text("reference_type"),
    description: text("description"),
    paymentMethod: text("payment_method"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("pt_userId_idx").on(table.userId),
    index("pt_userId_type_idx").on(table.userId, table.type),
    index("pt_userId_status_idx").on(table.userId, table.status),
    index("pt_userId_createdAt_idx").on(table.userId, table.createdAt),
  ]
);

export const premiumDealerPackageStatusEnum = pgEnum(
  "premium_dealer_package_status",
  ["active", "expired", "cancelled"]
);

/**
 * Activation history for premium dealer packages purchased by users.
 * Each activation creates one row to preserve lifecycle/audit information.
 */
export const premiumDealersPackage = pgTable(
  "premium_dealers_packages",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    packageName: text("package_name").notNull(),
    startDate: timestamp("start_date").notNull().defaultNow(),
    endDate: timestamp("end_date").notNull(),
    autoRenew: boolean("auto_renew").notNull().default(false),
    status: premiumDealerPackageStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("pdp_userId_idx").on(table.userId),
    index("pdp_status_idx").on(table.status),
    index("pdp_endDate_idx").on(table.endDate),
  ]
);
