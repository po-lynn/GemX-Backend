import { relations } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"
import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  index,
  primaryKey,
} from "drizzle-orm/pg-core"

/**
 * Category hierarchy based on:
 *
 * Loose Stones (root)
 *   ├── Faceted  → species: Ruby, Sapphire, Spinel
 *   └── Cabochon → species: Ruby, Jadeite, Star Sapphire
 *
 * Jewelry (root)
 *   ├── Rings
 *   ├── Pendants
 *   └── Earrings
 */

/** Category tree: parent → children */
export const productCategory = pgTable(
  "product_category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id").references((): AnyPgColumn => productCategory.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("product_category_parentId_idx").on(table.parentId)]
)

/** Gem species: Ruby, Sapphire, Spinel, Jadeite, Star Sapphire */
export const species = pgTable("species", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

/** Which species are available for which category (e.g. Faceted → Ruby, Sapphire, Spinel) */
export const categorySpecies = pgTable(
  "category_species",
  {
    categoryId: uuid("category_id")
      .notNull()
      .references(() => productCategory.id, { onDelete: "cascade" }),
    speciesId: uuid("species_id")
      .notNull()
      .references(() => species.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.categoryId, table.speciesId] }),
    index("category_species_categoryId_idx").on(table.categoryId),
    index("category_species_speciesId_idx").on(table.speciesId),
  ]
)

export const speciesRelations = relations(species, ({ many }) => ({
  categorySpecies: many(categorySpecies),
}))

export const categorySpeciesRelations = relations(categorySpecies, ({ one }) => ({
  category: one(productCategory),
  species: one(species),
}))
