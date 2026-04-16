import { relations } from "drizzle-orm"
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth-schema"
import { product } from "./product-schema"

/**
 * User-saved products (bookmarks/favourites) for mobile "Saved" screen.
 */
export const userFavouriteProduct = pgTable(
  "user_favourite_product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_favourite_product_user_product_unique").on(
      table.userId,
      table.productId
    ),
    index("user_favourite_product_user_id_idx").on(table.userId),
    index("user_favourite_product_product_id_idx").on(table.productId),
    index("user_favourite_product_created_at_idx").on(table.createdAt),
  ]
)

export const userFavouriteProductRelations = relations(
  userFavouriteProduct,
  ({ one }) => ({
    user: one(user, {
      fields: [userFavouriteProduct.userId],
      references: [user.id],
    }),
    product: one(product, {
      fields: [userFavouriteProduct.productId],
      references: [product.id],
    }),
  })
)
