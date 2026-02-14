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
import { category, productTypeEnum } from "./category-schema";
import { laboratory } from "./laboratory-schema";

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

/** Loose stone only: cut style */
export const stoneCutEnum = pgEnum("stone_cut", ["Faceted", "Cabochon"]);

/** Jewellery only: primary metal */
export const metalEnum = pgEnum("metal", ["Gold", "Silver", "Other"]);

export { productTypeEnum } from "./category-schema";

/**
 * Two inventory types:
 * - loose_stone: Loose high-value gemstones; may be certified or appraised separately.
 * - jewellery: Bundled jewelry (gemstones permanently set in metal); cert may cover whole piece or per-stone.
 */
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
    productType: productTypeEnum("product_type").notNull().default("loose_stone"),
    categoryId: uuid("category_id").references(() => category.id, { onDelete: "set null" }),
    /** Loose stone only: Faceted or Cabochon */
    stoneCut: stoneCutEnum("stone_cut"),
    /** Jewellery only: Gold, Silver, or Other */
    metal: metalEnum("metal"),
    materials: text("materials"),
    qualityGemstones: text("quality_gemstones"),
    /** Jewellery only: total weight of piece in grams (metal + stones), e.g. from report "Total: 28.48 gm" */
    totalWeightGrams: decimal("total_weight_grams", { precision: 12, scale: 4 }),
    // Specifications
    weightCarat: decimal("weight_carat", { precision: 10, scale: 4 }),
    dimensions: text("dimensions"),
    color: text("color"),
    shape: productShapeEnum("shape"),
    treatment: productTreatmentEnum("treatment"),
    origin: text("origin"),
    // Certification (product-level; gemstones can have their own cert fields)
    certLabName: text("cert_lab_name"),
    laboratoryId: uuid("laboratory_id").references(() => laboratory.id, {
      onDelete: "set null",
    }),
    certReportNumber: text("cert_report_number"),
    certReportDate: text("cert_report_date"),
    certReportUrl: text("cert_report_url"),
    status: productStatusEnum("status").notNull().default("active"),
    moderationStatus: productModerationEnum("moderation_status")
      .notNull()
      .default("pending"),
    isFeatured: boolean("is_featured").notNull().default(false),
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
    index("product_productType_idx").on(table.productType),
    index("product_categoryId_idx").on(table.categoryId),
    index("product_status_idx").on(table.status),
    index("product_moderationStatus_idx").on(table.moderationStatus),
    index("product_featured_idx").on(table.featured),
    index("product_currency_idx").on(table.currency),
    index("product_sku_idx").on(table.sku),
    index("product_weightCarat_idx").on(table.weightCarat),
    index("product_shape_idx").on(table.shape),
    index("product_isFeatured_idx").on(table.isFeatured),
    index("product_laboratoryId_idx").on(table.laboratoryId),
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

/** Jewellery only: gemstones on the piece with full specs (like loose stone): Ruby 0.5ct, dimensions, color, shape, etc. */
export const productJewelleryGemstone = pgTable(
  "product_jewellery_gemstone",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
    /** Number of stones of this type, e.g. report "Ruby: 37 pcs" */
    pieceCount: integer("piece_count"),
    weightCarat: decimal("weight_carat", { precision: 10, scale: 4 }).notNull(),
    dimensions: text("dimensions"),
    color: text("color"),
    shape: productShapeEnum("shape"),
    treatment: productTreatmentEnum("treatment"),
    origin: text("origin"),
    /** Cut style from report: e.g. Mixed cut, brilliant/step */
    cut: text("cut"),
    /** e.g. Transparent */
    transparency: text("transparency"),
    /** Comment from report: e.g. No indication of thermal treatment, FTIR-tested */
    comment: text("comment"),
    /** Magnification / inclusions: e.g. Rutiles, feathers, solids, zoning */
    inclusions: text("inclusions"),
    /** Report number for this stone (e.g. J202007463, GRS2025-080552) */
    certReportNumber: text("cert_report_number"),
    /** Report date (e.g. 2024-09-17) */
    certReportDate: text("cert_report_date"),
    /** Lab name (e.g. AGGL Gemmological Laboratory Myanmar, GRS Gemresearch Swisslab) */
    certLabName: text("cert_lab_name"),
  },
  (table) => [
    index("product_jewellery_gemstone_productId_idx").on(table.productId),
  ]
);

export const productRelations = relations(product, ({ one, many }) => ({
  category: one(category),
  laboratory: one(laboratory),
  seller: one(user),
  images: many(productImage),
  jewelleryGemstones: many(productJewelleryGemstone),
}));

export const productImageRelations = relations(productImage, ({ one }) => ({
  product: one(product, {
    fields: [productImage.productId],
    references: [product.id],
  }),
}));

export const productJewelleryGemstoneRelations = relations(
  productJewelleryGemstone,
  ({ one }) => ({
    product: one(product, {
      fields: [productJewelleryGemstone.productId],
      references: [product.id],
    }),
    category: one(category, {
      fields: [productJewelleryGemstone.categoryId],
      references: [category.id],
    }),
  })
);
