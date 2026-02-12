import { pgTable, text, timestamp, uuid, integer, index, uniqueIndex, pgEnum } from "drizzle-orm/pg-core"

export const productTypeEnum = pgEnum("product_type", ["loose_stone", "jewellery"])

/**
 * Category: type (loose_stone | jewellery) + name (e.g. Ruby, Ring).
 * Products pick one category; form shows categories filtered by product type.
 */
export const category = pgTable(
  "category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: productTypeEnum("type").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("category_type_idx").on(table.type),
    uniqueIndex("category_type_slug_unique").on(table.type, table.slug),
  ]
)
