import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { product } from "./product-schema";

/**
 * Mobile user asks admin to surface/show a collector-piece listing.
 * `userInfoJson` stores a client-provided snapshot (name, phone, etc.) at request time.
 */
export const collectorPieceShowRequest = pgTable(
  "collector_piece_show_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    /** JSON string: snapshot of requester info from the mobile app */
    userInfoJson: text("user_info_json").notNull(),
    /** Optional note to admin */
    message: text("message"),
    /** Admin workflow: pending | reviewed | dismissed (extensible) */
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("collector_piece_show_request_user_id_idx").on(table.userId),
    index("collector_piece_show_request_product_id_idx").on(table.productId),
    index("collector_piece_show_request_created_at_idx").on(table.createdAt),
  ]
);

export const collectorPieceShowRequestRelations = relations(
  collectorPieceShowRequest,
  ({ one }) => ({
    user: one(user, {
      fields: [collectorPieceShowRequest.userId],
      references: [user.id],
    }),
    product: one(product, {
      fields: [collectorPieceShowRequest.productId],
      references: [product.id],
    }),
  })
);
