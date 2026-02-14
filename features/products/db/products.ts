import { db } from "@/drizzle/db"
import { product, productImage, productJewelleryGemstone } from "@/drizzle/schema/product-schema"
import { category } from "@/drizzle/schema/category-schema"
import { laboratory } from "@/drizzle/schema/laboratory-schema"
import { user } from "@/drizzle/schema/auth-schema"
import { eq, ilike, inArray, or, sql, desc } from "drizzle-orm"
import type { ProductCreate } from "@/features/products/schemas/products"
import type { GemstoneSpec } from "@/features/products/schemas/gemstone-spec"

/** Same spec shape as loose stone; used for jewellery piece gemstones (with categoryId/categoryName). */
export type JewelleryGemstoneRow = GemstoneSpec & {
  categoryId: string
  categoryName: string
  weightCarat: string
  pieceCount: number | null
}

export type AdminProductRow = {
  id: string
  sku: string | null
  title: string
  description: string | null
  price: string
  currency: "USD" | "MMK"
  productType: "loose_stone" | "jewellery"
  categoryId: string | null
  categoryName: string | null
  stoneCut: "Faceted" | "Cabochon" | null
  metal: "Gold" | "Silver" | "Other" | null
  materials: string | null
  qualityGemstones: string | null
  status: "active" | "archive" | "sold" | "hidden"
  moderationStatus: "pending" | "approved" | "rejected"
  isFeatured: boolean
  laboratoryId: string | null
  featured: number
  sellerId: string
  sellerName: string
  sellerPhone: string | null
  imageUrl: string | null
  createdAt: Date
}

export async function getAdminProductsFromDb(opts: {
  page?: number
  limit?: number
  search?: string
}): Promise<{ products: AdminProductRow[]; total: number }> {
  const page = opts.page ?? 1
  const limit = Math.min(opts.limit ?? 20, 100)
  const offset = (page - 1) * limit
  const search = opts.search?.trim()

  const searchCondition = search
    ? or(
        ilike(product.title, `%${search}%`),
        ilike(user.name, `%${search}%`),
        ilike(user.phone ?? "", `%${search}%`),
        ilike(user.email, `%${search}%`)
      )
    : undefined

  const [productsData, countResult] = await Promise.all([
    db
      .select({
        id: product.id,
        sku: product.sku,
        title: product.title,
        description: product.description,
        price: product.price,
        currency: product.currency,
        productType: product.productType,
        categoryId: product.categoryId,
        categoryName: category.name,
        stoneCut: product.stoneCut,
        metal: product.metal,
        laboratoryId: product.laboratoryId,
        materials: product.materials,
        qualityGemstones: product.qualityGemstones,
        status: product.status,
        moderationStatus: product.moderationStatus,
        isFeatured: product.isFeatured,
        featured: product.featured,
        sellerId: product.sellerId,
        sellerName: user.name,
        sellerPhone: user.phone,
        createdAt: product.createdAt,
      })
      .from(product)
      .innerJoin(user, eq(product.sellerId, user.id))
      .leftJoin(category, eq(product.categoryId, category.id))
      .leftJoin(laboratory, eq(product.laboratoryId, laboratory.id))
      .where(searchCondition)
      .orderBy(desc(product.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(product)
      .innerJoin(user, eq(product.sellerId, user.id))
      .where(searchCondition),
  ])

  const productIds = productsData.map((p) => p.id)
  const images =
    productIds.length > 0
      ? await db
          .select({
            productId: productImage.productId,
            url: productImage.url,
            sortOrder: productImage.sortOrder,
          })
          .from(productImage)
          .where(inArray(productImage.productId, productIds))
          .orderBy(productImage.sortOrder)
      : []

  const imageByProduct = new Map<string, string>()
  for (const img of images) {
    if (!imageByProduct.has(img.productId)) {
      imageByProduct.set(img.productId, img.url)
    }
  }

  const products: AdminProductRow[] = productsData.map((p) => ({
    id: p.id,
    sku: p.sku,
    title: p.title,
    description: p.description,
    price: String(p.price),
    currency: p.currency,
    productType: p.productType,
    categoryId: p.categoryId,
    categoryName: p.categoryName ?? null,
    stoneCut: p.stoneCut,
    metal: p.metal,
    materials: p.materials,
    qualityGemstones: p.qualityGemstones,
    status: p.status,
    laboratoryId: p.laboratoryId,
    moderationStatus: p.moderationStatus,
    isFeatured: p.isFeatured,
    featured: p.featured,
    sellerId: p.sellerId,
    sellerName: p.sellerName,
    sellerPhone: p.sellerPhone,
    imageUrl: imageByProduct.get(p.id) ?? null,
    createdAt: p.createdAt,
  }))

  const total = countResult[0]?.count ?? 0

  return { products, total }
}

export type ProductForEdit = {
  id: string
  sku: string | null
  title: string
  description: string | null
  price: string
  currency: "USD" | "MMK"
  isNegotiable: boolean
  productType: "loose_stone" | "jewellery"
  categoryId: string | null
  stoneCut: "Faceted" | "Cabochon" | null
  metal: "Gold" | "Silver" | "Other" | null
  materials: string | null
  qualityGemstones: string | null
  jewelleryGemstones: JewelleryGemstoneRow[]
  totalWeightGrams: string | null
  weightCarat: string | null
  dimensions: string | null
  color: string | null
  shape: string | null
  treatment: string | null
  origin: string | null
  laboratoryId: string | null
  certReportNumber: string | null
  certReportDate: string | null
  certReportUrl: string | null
  status: "active" | "archive" | "sold" | "hidden"
  moderationStatus: "pending" | "approved" | "rejected"
  isFeatured: boolean
  featured: number
  sellerId: string
  imageUrls: string[]
}

export async function getProductById(id: string): Promise<ProductForEdit | null> {
  const [row] = await db
    .select({
      id: product.id,
      sku: product.sku,
      title: product.title,
      description: product.description,
      price: product.price,
      currency: product.currency,
      isNegotiable: product.isNegotiable,
      productType: product.productType,
      categoryId: product.categoryId,
      stoneCut: product.stoneCut,
      metal: product.metal,
      materials: product.materials,
      qualityGemstones: product.qualityGemstones,
      totalWeightGrams: product.totalWeightGrams,
      weightCarat: product.weightCarat,
      dimensions: product.dimensions,
      color: product.color,
      shape: product.shape,
      treatment: product.treatment,
      origin: product.origin,
      laboratoryId: product.laboratoryId,
      certReportNumber: product.certReportNumber,
      certReportDate: product.certReportDate,
      certReportUrl: product.certReportUrl,
      status: product.status,
      moderationStatus: product.moderationStatus,
      isFeatured: product.isFeatured,
      featured: product.featured,
      sellerId: product.sellerId,
    })
    .from(product)
    .where(eq(product.id, id))

  if (!row) return null

  const [images, gemstoneRows] = await Promise.all([
    db
      .select({ url: productImage.url })
      .from(productImage)
      .where(eq(productImage.productId, id))
      .orderBy(productImage.sortOrder),
    db
      .select({
        categoryId: productJewelleryGemstone.categoryId,
        categoryName: category.name,
        pieceCount: productJewelleryGemstone.pieceCount,
        weightCarat: productJewelleryGemstone.weightCarat,
        dimensions: productJewelleryGemstone.dimensions,
        color: productJewelleryGemstone.color,
        shape: productJewelleryGemstone.shape,
        treatment: productJewelleryGemstone.treatment,
        origin: productJewelleryGemstone.origin,
        cut: productJewelleryGemstone.cut,
        transparency: productJewelleryGemstone.transparency,
        comment: productJewelleryGemstone.comment,
        inclusions: productJewelleryGemstone.inclusions,
        certReportNumber: productJewelleryGemstone.certReportNumber,
        certReportDate: productJewelleryGemstone.certReportDate,
        certLabName: productJewelleryGemstone.certLabName,
      })
      .from(productJewelleryGemstone)
      .innerJoin(category, eq(productJewelleryGemstone.categoryId, category.id))
      .where(eq(productJewelleryGemstone.productId, id)),
  ])

  const jewelleryGemstones: JewelleryGemstoneRow[] = gemstoneRows.map((g) => ({
    categoryId: g.categoryId,
    categoryName: g.categoryName,
    weightCarat: String(g.weightCarat),
    pieceCount: g.pieceCount ?? null,
    dimensions: g.dimensions ?? null,
    color: g.color ?? null,
    shape: g.shape ?? null,
    treatment: g.treatment ?? null,
    origin: g.origin ?? null,
    cut: g.cut ?? null,
    transparency: g.transparency ?? null,
    comment: g.comment ?? null,
    inclusions: g.inclusions ?? null,
    certReportNumber: g.certReportNumber ?? null,
    certReportDate: g.certReportDate ?? null,
    certLabName: g.certLabName ?? null,
  }))

  return {
    id: row.id,
    sku: row.sku,
    title: row.title,
    description: row.description,
    price: String(row.price),
    currency: row.currency,
    isNegotiable: row.isNegotiable,
    productType: row.productType,
    categoryId: row.categoryId,
    stoneCut: row.stoneCut,
    metal: row.metal,
    materials: row.materials,
    qualityGemstones: row.qualityGemstones,
    jewelleryGemstones,
    totalWeightGrams: row.totalWeightGrams ? String(row.totalWeightGrams) : null,
    weightCarat: row.weightCarat ? String(row.weightCarat) : null,
    dimensions: row.dimensions,
    color: row.color,
    shape: row.shape,
    treatment: row.treatment,
    origin: row.origin,
    laboratoryId: row.laboratoryId,
    certReportNumber: row.certReportNumber,
    certReportDate: row.certReportDate ?? null,
    certReportUrl: row.certReportUrl,
    status: row.status,
    moderationStatus: row.moderationStatus,
    isFeatured: row.isFeatured,
    featured: row.featured,
    sellerId: row.sellerId,
    imageUrls: images.map((i) => i.url),
  }
}

export type CreateProductInput = ProductCreate & {
  sellerId: string
  categoryId?: string | null
}

function generateSku(): string {
  const prefix = "PRD"
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()
  return `${prefix}-${id}`
}

export async function createProductInDb(input: CreateProductInput): Promise<string> {
  const sku = input.sku?.trim() ? input.sku.trim() : generateSku()

  const values: typeof product.$inferInsert = {
    title: input.title,
    sku,
    description: input.description ?? null,
    price: input.price,
    currency: input.currency,
    isNegotiable: input.isNegotiable ?? false,
    productType: input.productType ?? "loose_stone",
    categoryId: input.categoryId ?? null,
    stoneCut: input.stoneCut ?? null,
    metal: input.metal ?? null,
    materials: input.materials ?? null,
    qualityGemstones: input.qualityGemstones ?? null,
    totalWeightGrams: input.totalWeightGrams ?? null,
    weightCarat: input.weightCarat ?? null,
    dimensions: input.dimensions ?? null,
    color: input.color ?? null,
    shape: input.shape ?? null,
    treatment: input.treatment ?? null,
    origin: input.origin ?? null,
    laboratoryId: input.laboratoryId ?? null,
    certReportNumber: input.certReportNumber ?? null,
    certReportDate: input.certReportDate ?? null,
    certReportUrl: input.certReportUrl ?? null,
    status: input.status ?? "active",
    isFeatured: input.isFeatured ?? false,
    sellerId: input.sellerId,
  }

  const [inserted] = await db
    .insert(product)
    .values(values)
    .returning({ id: product.id })

  const productId = inserted!.id

  const urls = input.imageUrls ?? []
  if (urls.length > 0) {
    await db.insert(productImage).values(
      urls.map((url, i) => ({
        productId,
        url,
        sortOrder: i,
      }))
    )
  }

  const gemstones = input.jewelleryGemstones ?? []
  if (gemstones.length > 0) {
    await db.insert(productJewelleryGemstone).values(
      gemstones.map((g) => ({
        productId,
        categoryId: g.categoryId,
        pieceCount: g.pieceCount ?? null,
        weightCarat: g.weightCarat,
        dimensions: g.dimensions ?? null,
        color: g.color ?? null,
        shape: (g.shape as (typeof productJewelleryGemstone.$inferInsert)["shape"]) ?? null,
        treatment: (g.treatment as (typeof productJewelleryGemstone.$inferInsert)["treatment"]) ?? null,
        origin: g.origin ?? null,
        cut: g.cut ?? null,
        transparency: g.transparency ?? null,
        comment: g.comment ?? null,
        inclusions: g.inclusions ?? null,
        certReportNumber: g.certReportNumber ?? null,
        certReportDate: g.certReportDate ?? null,
        certLabName: g.certLabName ?? null,
      }))
    )
  }

  return productId
}

export type UpdateProductInput = {
  title?: string
  sku?: string | null
  description?: string | null
  price?: string
  currency?: "USD" | "MMK"
  isNegotiable?: boolean
  productType?: "loose_stone" | "jewellery"
  categoryId?: string | null
  stoneCut?: "Faceted" | "Cabochon" | null
  metal?: "Gold" | "Silver" | "Other" | null
  materials?: string | null
  qualityGemstones?: string | null
  jewelleryGemstones?: {
    categoryId: string
    weightCarat: string
    pieceCount?: number | null
    dimensions?: string | null
    color?: string | null
    shape?: string | null
    treatment?: string | null
    origin?: string | null
    cut?: string | null
    transparency?: string | null
    comment?: string | null
    inclusions?: string | null
    certReportNumber?: string | null
    certReportDate?: string | null
    certLabName?: string | null
  }[]
  totalWeightGrams?: string | null
  weightCarat?: string | null
  dimensions?: string | null
  color?: string | null
  shape?: string | null
  treatment?: string | null
  origin?: string | null
  laboratoryId?: string | null
  certReportNumber?: string | null
  certReportDate?: string | null
  certReportUrl?: string | null
  status?: "active" | "archive" | "sold" | "hidden"
  moderationStatus?: "pending" | "approved" | "rejected"
  isFeatured?: boolean
  featured?: number
  imageUrls?: string[]
}

export async function updateProductInDb(
  id: string,
  input: UpdateProductInput
): Promise<void> {
  const { imageUrls, jewelleryGemstones, ...rest } = input

  const updates: Partial<typeof product.$inferInsert> = {}
  if (rest.title !== undefined) updates.title = rest.title
  if (rest.sku !== undefined) {
    updates.sku = rest.sku
  } else {
    const [row] = await db.select({ sku: product.sku }).from(product).where(eq(product.id, id))
    if (row && !row.sku) updates.sku = generateSku()
  }
  if (rest.description !== undefined) updates.description = rest.description
  if (rest.price !== undefined) updates.price = rest.price
  if (rest.currency !== undefined) updates.currency = rest.currency
  if (rest.isNegotiable !== undefined) updates.isNegotiable = rest.isNegotiable
  if (rest.productType !== undefined) updates.productType = rest.productType
  if (rest.categoryId !== undefined) updates.categoryId = rest.categoryId
  if (rest.stoneCut !== undefined) updates.stoneCut = rest.stoneCut
  if (rest.metal !== undefined) updates.metal = rest.metal
  if (rest.materials !== undefined) updates.materials = rest.materials
  if (rest.qualityGemstones !== undefined) updates.qualityGemstones = rest.qualityGemstones
  if (rest.totalWeightGrams !== undefined) updates.totalWeightGrams = rest.totalWeightGrams
  if (rest.weightCarat !== undefined) updates.weightCarat = rest.weightCarat
  if (rest.dimensions !== undefined) updates.dimensions = rest.dimensions
  if (rest.color !== undefined) updates.color = rest.color
  if (rest.shape !== undefined)
    updates.shape = rest.shape as (typeof product.$inferInsert)["shape"]
  if (rest.treatment !== undefined)
    updates.treatment = rest.treatment as (typeof product.$inferInsert)["treatment"]
  if (rest.origin !== undefined) updates.origin = rest.origin
  if (rest.laboratoryId !== undefined) updates.laboratoryId = rest.laboratoryId
  if (rest.certReportNumber !== undefined)
    updates.certReportNumber = rest.certReportNumber
  if (rest.certReportDate !== undefined) updates.certReportDate = rest.certReportDate
  if (rest.certReportUrl !== undefined) updates.certReportUrl = rest.certReportUrl
  if (rest.status !== undefined) updates.status = rest.status
  if (rest.moderationStatus !== undefined)
    updates.moderationStatus = rest.moderationStatus
  if (rest.isFeatured !== undefined) updates.isFeatured = rest.isFeatured
  if (rest.featured !== undefined) updates.featured = rest.featured

  if (Object.keys(updates).length > 0) {
    await db.update(product).set(updates).where(eq(product.id, id))
  }

  if (jewelleryGemstones !== undefined) {
    await db.delete(productJewelleryGemstone).where(eq(productJewelleryGemstone.productId, id))
    if (jewelleryGemstones.length > 0) {
      await db.insert(productJewelleryGemstone).values(
        jewelleryGemstones.map((g) => ({
          productId: id,
          categoryId: g.categoryId,
          pieceCount: g.pieceCount ?? null,
          weightCarat: g.weightCarat,
          dimensions: g.dimensions ?? null,
          color: g.color ?? null,
          shape: (g.shape as (typeof productJewelleryGemstone.$inferInsert)["shape"]) ?? null,
          treatment: (g.treatment as (typeof productJewelleryGemstone.$inferInsert)["treatment"]) ?? null,
          origin: g.origin ?? null,
          cut: g.cut ?? null,
          transparency: g.transparency ?? null,
          comment: g.comment ?? null,
          inclusions: g.inclusions ?? null,
          certReportNumber: g.certReportNumber ?? null,
          certReportDate: g.certReportDate ?? null,
          certLabName: g.certLabName ?? null,
        }))
      )
    }
  }

  if (imageUrls !== undefined) {
    await db.delete(productImage).where(eq(productImage.productId, id))
    if (imageUrls.length > 0) {
      await db.insert(productImage).values(
        imageUrls.map((url, i) => ({
          productId: id,
          url,
          sortOrder: i,
        }))
      )
    }
  }
}

export async function deleteProductInDb(id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(product)
    .where(eq(product.id, id))
    .returning({ id: product.id })

  return !!deleted
}
