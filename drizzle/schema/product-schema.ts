import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  decimal,
  integer,
  boolean,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { productCategory, species, categorySpecies } from "./category-schema";

export const productStatusEnum = pgEnum("product_status", [
  "active",   // In Stock
  "archive",  // Archived
  "sold",     // Sold
  "hidden",   // Reserved / hidden
]);

export const productModerationEnum = pgEnum("product_moderation", [
  "pending",
  "approved",
  "rejected",
]);

export const currencyEnum = pgEnum("currency", ["USD", "MMK"]);

export const productShapeEnum = pgEnum("product_shape", [
  "Oval",
  "Cushion",
  "Round",
  "Pear",
  "Heart",
]);

export const productTreatmentEnum = pgEnum("product_treatment", [
  "None",
  "Heated",
  "Oiled",
  "Glass Filled",
]);

export { productCategory };

export const product = pgTable(
  "product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").unique(),
    title: text("title").notNull(),
    description: text("description"),
    price: decimal("price", { precision: 14, scale: 2 }).notNull(),
    currency: currencyEnum("currency").notNull().default("USD"),
    isNegotiable: boolean("is_negotiable").notNull().default(false),
    categoryId: uuid("category_id").references(() => productCategory.id, {
      onDelete: "set null",
    }),
    speciesId: uuid("species_id").references(() => species.id, {
      onDelete: "set null",
    }),
    // Specifications
    weightCarat: decimal("weight_carat", { precision: 10, scale: 4 }),
    dimensions: text("dimensions"),
    color: text("color"),
    shape: productShapeEnum("shape"),
    treatment: productTreatmentEnum("treatment"),
    origin: text("origin"),
    // Certification
    certLabName: text("cert_lab_name"),
    certReportNumber: text("cert_report_number"),
    certReportUrl: text("cert_report_url"),
    condition: text("condition"),
    location: text("location"),
    status: productStatusEnum("status").notNull().default("active"),
    moderationStatus: productModerationEnum("moderation_status")
      .notNull()
      .default("pending"),
    isFeatured: boolean("is_featured").notNull().default(false),
    featured: integer("featured").notNull().default(0), // 0 = not featured, higher = sort order
    colorGrade: text("color_grade"),
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
    index("product_speciesId_idx").on(table.speciesId),
    index("product_status_idx").on(table.status),
    index("product_moderationStatus_idx").on(table.moderationStatus),
    index("product_featured_idx").on(table.featured),
    index("product_currency_idx").on(table.currency),
    index("product_sku_idx").on(table.sku),
    index("product_weightCarat_idx").on(table.weightCarat),
    index("product_shape_idx").on(table.shape),
    index("product_isFeatured_idx").on(table.isFeatured),
    index("product_colorGrade_idx").on(table.colorGrade),
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

export const productRelations = relations(product, ({ one, many }) => ({
  category: one(productCategory),
  species: one(species),
  seller: one(user),
  images: many(productImage),
}));

export const productCategoryRelations = relations(productCategory, ({ one, many }) => ({
  parent: one(productCategory, {
    fields: [productCategory.parentId],
    references: [productCategory.id],
    relationName: "categoryParent",
  }),
  children: many(productCategory, { relationName: "categoryParent" }),
  products: many(product),
  categorySpecies: many(categorySpecies),
}));

export const productImageRelations = relations(productImage, ({ one }) => ({
  product: one(product, {
    fields: [productImage.productId],
    references: [product.id],
  }),
}));
