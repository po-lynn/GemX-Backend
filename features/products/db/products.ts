import { db } from "@/drizzle/db"
import {
  product,
  productCategory,
  productImage,
} from "@/drizzle/schema/product-schema"
import { species } from "@/drizzle/schema/category-schema"
import { user } from "@/drizzle/schema/auth-schema"
import { eq, ilike, inArray, or, sql, desc } from "drizzle-orm"
import type { ProductCreate } from "@/features/products/schemas/products"

export type AdminProductRow = {
  id: string
  sku: string | null
  title: string
  description: string | null
  price: string
  currency: "USD" | "MMK"
  categoryId: string | null
  categoryName: string | null
  categorySlug: string | null
  speciesId: string | null
  speciesName: string | null
  condition: string | null
  location: string | null
  status: "active" | "sold" | "hidden"
  moderationStatus: "pending" | "approved" | "rejected"
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
        categoryId: product.categoryId,
        categoryName: productCategory.name,
        categorySlug: productCategory.slug,
        speciesId: product.speciesId,
        speciesName: species.name,
        condition: product.condition,
        location: product.location,
        status: product.status,
        moderationStatus: product.moderationStatus,
        featured: product.featured,
        sellerId: product.sellerId,
        sellerName: user.name,
        sellerPhone: user.phone,
        createdAt: product.createdAt,
      })
      .from(product)
      .leftJoin(productCategory, eq(product.categoryId, productCategory.id))
      .leftJoin(species, eq(product.speciesId, species.id))
      .innerJoin(user, eq(product.sellerId, user.id))
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
    categoryId: p.categoryId,
    categoryName: p.categoryName,
    categorySlug: p.categorySlug,
    speciesId: p.speciesId,
    speciesName: p.speciesName,
    condition: p.condition,
    location: p.location,
    status: p.status,
    moderationStatus: p.moderationStatus,
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
  categoryId: string | null
  speciesId: string | null
  weightCarat: string | null
  dimensions: string | null
  color: string | null
  shape: string | null
  treatment: string | null
  origin: string | null
  certLabName: string | null
  certReportNumber: string | null
  certReportUrl: string | null
  condition: string | null
  location: string | null
  status: "active" | "sold" | "hidden"
  moderationStatus: "pending" | "approved" | "rejected"
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
      categoryId: product.categoryId,
      speciesId: product.speciesId,
      weightCarat: product.weightCarat,
      dimensions: product.dimensions,
      color: product.color,
      shape: product.shape,
      treatment: product.treatment,
      origin: product.origin,
      certLabName: product.certLabName,
      certReportNumber: product.certReportNumber,
      certReportUrl: product.certReportUrl,
      condition: product.condition,
      location: product.location,
      status: product.status,
      moderationStatus: product.moderationStatus,
      featured: product.featured,
      sellerId: product.sellerId,
    })
    .from(product)
    .where(eq(product.id, id))

  if (!row) return null

  const images = await db
    .select({ url: productImage.url })
    .from(productImage)
    .where(eq(productImage.productId, id))
    .orderBy(productImage.sortOrder)

  return {
    id: row.id,
    sku: row.sku,
    title: row.title,
    description: row.description,
    price: String(row.price),
    currency: row.currency,
    isNegotiable: row.isNegotiable,
    categoryId: row.categoryId,
    speciesId: row.speciesId,
    weightCarat: row.weightCarat ? String(row.weightCarat) : null,
    dimensions: row.dimensions,
    color: row.color,
    shape: row.shape,
    treatment: row.treatment,
    origin: row.origin,
    certLabName: row.certLabName,
    certReportNumber: row.certReportNumber,
    certReportUrl: row.certReportUrl,
    condition: row.condition,
    location: row.location,
    status: row.status,
    moderationStatus: row.moderationStatus,
    featured: row.featured,
    sellerId: row.sellerId,
    imageUrls: images.map((i) => i.url),
  }
}

// Re-export category/species types and functions from categories feature
export type {
  CategoryOption,
  CategoryWithParent,
  CategoryTreeNode,
  SpeciesOption,
} from "@/features/categories/db/categories"
export {
  getAllCategories,
  getCategoriesWithParent,
  getCategoriesTree,
  getAllSpecies,
} from "@/features/categories/db/categories"

export type CreateProductInput = ProductCreate & {
  sellerId: string
}

export async function createProductInDb(input: CreateProductInput): Promise<string> {
  const values: typeof product.$inferInsert = {
    title: input.title,
    sku: input.sku ?? null,
    description: input.description ?? null,
    price: input.price,
    currency: input.currency,
    isNegotiable: input.isNegotiable ?? false,
    categoryId: input.categoryId ?? null,
    speciesId: input.speciesId ?? null,
    weightCarat: input.weightCarat ?? null,
    dimensions: input.dimensions ?? null,
    color: input.color ?? null,
    shape: input.shape ?? null,
    treatment: input.treatment ?? null,
    origin: input.origin ?? null,
    certLabName: input.certLabName ?? null,
    certReportNumber: input.certReportNumber ?? null,
    certReportUrl: input.certReportUrl ?? null,
    condition: input.condition ?? null,
    location: input.location ?? null,
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

  return productId
}

export type UpdateProductInput = {
  title?: string
  sku?: string | null
  description?: string | null
  price?: string
  currency?: "USD" | "MMK"
  isNegotiable?: boolean
  categoryId?: string | null
  speciesId?: string | null
  weightCarat?: string | null
  dimensions?: string | null
  color?: string | null
  shape?: string | null
  treatment?: string | null
  origin?: string | null
  certLabName?: string | null
  certReportNumber?: string | null
  certReportUrl?: string | null
  condition?: string | null
  location?: string | null
  status?: "active" | "sold" | "hidden"
  moderationStatus?: "pending" | "approved" | "rejected"
  featured?: number
  imageUrls?: string[]
}

export async function updateProductInDb(
  id: string,
  input: UpdateProductInput
): Promise<void> {
  const { imageUrls, ...rest } = input

  const updates: Partial<typeof product.$inferInsert> = {}
  if (rest.title !== undefined) updates.title = rest.title
  if (rest.sku !== undefined) updates.sku = rest.sku
  if (rest.description !== undefined) updates.description = rest.description
  if (rest.price !== undefined) updates.price = rest.price
  if (rest.currency !== undefined) updates.currency = rest.currency
  if (rest.isNegotiable !== undefined) updates.isNegotiable = rest.isNegotiable
  if (rest.categoryId !== undefined) updates.categoryId = rest.categoryId
  if (rest.speciesId !== undefined) updates.speciesId = rest.speciesId
  if (rest.weightCarat !== undefined) updates.weightCarat = rest.weightCarat
  if (rest.dimensions !== undefined) updates.dimensions = rest.dimensions
  if (rest.color !== undefined) updates.color = rest.color
  if (rest.shape !== undefined)
    updates.shape = rest.shape as (typeof product.$inferInsert)["shape"]
  if (rest.treatment !== undefined)
    updates.treatment = rest.treatment as (typeof product.$inferInsert)["treatment"]
  if (rest.origin !== undefined) updates.origin = rest.origin
  if (rest.certLabName !== undefined) updates.certLabName = rest.certLabName
  if (rest.certReportNumber !== undefined)
    updates.certReportNumber = rest.certReportNumber
  if (rest.certReportUrl !== undefined) updates.certReportUrl = rest.certReportUrl
  if (rest.condition !== undefined) updates.condition = rest.condition
  if (rest.location !== undefined) updates.location = rest.location
  if (rest.status !== undefined) updates.status = rest.status
  if (rest.moderationStatus !== undefined)
    updates.moderationStatus = rest.moderationStatus
  if (rest.featured !== undefined) updates.featured = rest.featured

  if (Object.keys(updates).length > 0) {
    await db.update(product).set(updates).where(eq(product.id, id))
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
