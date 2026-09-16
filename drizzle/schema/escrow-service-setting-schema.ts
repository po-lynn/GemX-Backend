import { sql } from "drizzle-orm"
import { pgTable, text, timestamp, numeric, integer, bigint, index } from "drizzle-orm/pg-core"
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
    /**
     * Escrow-case fee terms, snapshotted onto each escrow_case at creation time (see
     * escrow-case-schema.ts) so an in-flight case's fee never retroactively changes.
     * Basis points (5000 = 50%) to avoid float math on money splits.
     */
    buyerFeeShareBps: integer("buyer_fee_share_bps").notNull().default(5000),
    sellerFeeShareBps: integer("seller_fee_share_bps").notNull().default(5000),
    feeMinMinor: bigint("fee_min_minor", { mode: "number" }),
    feeCapMinor: bigint("fee_cap_minor", { mode: "number" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("escrow_service_setting_user_id_idx").on(table.userId)]
).enableRLS()

