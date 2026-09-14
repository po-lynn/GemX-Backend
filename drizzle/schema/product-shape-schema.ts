import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

/** Lookup table for admin-managed product shapes. Named `product_shapes` (plural)
 *  to avoid conflicting with the existing Postgres enum type `product_shape`. */
export const productShapes = pgTable("product_shapes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
