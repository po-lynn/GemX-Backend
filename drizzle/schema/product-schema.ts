import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  decimal,
  integer,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const productStatusEnum = pgEnum("product_status", [
  "active",
  "sold",
  "hidden",
]);

export const productModerationEnum = pgEnum("product_moderation", [
  "pending",
  "approved",
  "rejected",
]);

export const currencyEnum = pgEnum("currency", ["USD", "MMK"]);

export const productCategory = pgTable("product_category", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const product = pgTable(
  "product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    price: decimal("price", { precision: 14, scale: 2 }).notNull(),
    currency: currencyEnum("currency").notNull().default("USD"),
    categoryId: uuid("category_id").references(() => productCategory.id, {
      onDelete: "set null",
    }),
    condition: text("condition"), // e.g. "new", "used", "certified"
    location: text("location"),
    status: productStatusEnum("status").notNull().default("active"),
    moderationStatus: productModerationEnum("moderation_status")
      .notNull()
      .default("pending"),
    featured: integer("featured").notNull().default(0), // 0 = not featured, higher = sort order
    sellerId: text("seller_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("product_sellerId_idx").on(table.sellerId),
    index("product_categoryId_idx").on(table.categoryId),
    index("product_status_idx").on(table.status),
    index("product_moderationStatus_idx").on(table.moderationStatus),
    index("product_featured_idx").on(table.featured),
    index("product_currency_idx").on(table.currency),
  ]
);

export const productImage = pgTable(
  "product_image",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("product_image_productId_idx").on(table.productId)]
);

export const productCategoryRelations = relations(productCategory, ({ many }) => ({
  products: many(product),
}));

export const productRelations = relations(product, ({ one, many }) => ({
  category: one(productCategory),
  seller: one(user),
  images: many(productImage),
}));

export const productImageRelations = relations(productImage, ({ one }) => ({
  product: one(product, {
    fields: [productImage.productId],
    references: [product.id],
  }),
}));
