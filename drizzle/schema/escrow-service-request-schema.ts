import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { product } from "./product-schema";

/**
 * Mobile user (buyer or seller) submits an escrow service request.
 * GemX admin reviews the request, contacts the requester, and facilitates the deal.
 *
 * `packageName` — optional reference to a premium dealers package the user is interested in.
 * `adminNote`   — internal admin note, never exposed to mobile clients.
 */
export const escrowServiceRequest = pgTable(
  "escrow_service_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** "buyer" — wants to verify product before purchase; "seller" — wants buyer commitment */
    type: text("type").notNull(),
    /** Optional FK to an existing product in the catalog */
    productId: uuid("product_id").references(() => product.id, {
      onDelete: "set null",
    }),
    /** Seller of the product — populated from product.sellerId when productId is provided */
    sellerId: text("seller_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** Which premium dealer package the user is interested in */
    packageName: text("package_name"),
    /** Optional note from the requester to admin */
    message: text("message"),
    /** Admin workflow: pending | contacted | deal_made | rejected */
    status: text("status").notNull().default("pending"),
    /** Internal admin note — never returned to mobile clients */
    adminNote: text("admin_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("escrow_service_request_user_id_idx").on(table.userId),
    index("escrow_service_request_status_idx").on(table.status),
    index("escrow_service_request_created_at_idx").on(table.createdAt),
  ]
);

export const escrowServiceRequestRelations = relations(
  escrowServiceRequest,
  ({ one }) => ({
    user: one(user, {
      fields: [escrowServiceRequest.userId],
      references: [user.id],
    }),
    seller: one(user, {
      fields: [escrowServiceRequest.sellerId],
      references: [user.id],
      relationName: "escrowSeller",
    }),
    product: one(product, {
      fields: [escrowServiceRequest.productId],
      references: [product.id],
    }),
  })
);
