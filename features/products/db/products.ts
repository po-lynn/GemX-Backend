import { db } from "@/drizzle/db"
import {
  product,
  productCategory,
  productImage,
} from "@/drizzle/schema/product-schema"
import { user } from "@/drizzle/schema/auth-schema"
import { eq, ilike, inArray, or, sql, desc } from "drizzle-orm"

export type AdminProductRow = {
  id: string
  title: string
  description: string | null
  price: string
  currency: "USD" | "MMK"
  categoryId: string | null
  categoryName: string | null
  categorySlug: string | null
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
        title: product.title,
        description: product.description,
        price: product.price,
        currency: product.currency,
        categoryId: product.categoryId,
        categoryName: productCategory.name,
        categorySlug: productCategory.slug,
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
    title: p.title,
    description: p.description,
    price: String(p.price),
    currency: p.currency,
    categoryId: p.categoryId,
    categoryName: p.categoryName,
    categorySlug: p.categorySlug,
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
  title: string
  description: string | null
  price: string
  currency: "USD" | "MMK"
  categoryId: string | null
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
      title: product.title,
      description: product.description,
      price: product.price,
      currency: product.currency,
      categoryId: product.categoryId,
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
    title: row.title,
    description: row.description,
    price: String(row.price),
    currency: row.currency,
    categoryId: row.categoryId,
    condition: row.condition,
    location: row.location,
    status: row.status,
    moderationStatus: row.moderationStatus,
    featured: row.featured,
    sellerId: row.sellerId,
    imageUrls: images.map((i) => i.url),
  }
}

export type CategoryOption = { id: string; name: string; slug: string }

export async function getAllCategories(): Promise<CategoryOption[]> {
  const rows = await db
    .select({
      id: productCategory.id,
      name: productCategory.name,
      slug: productCategory.slug,
    })
    .from(productCategory)
    .orderBy(productCategory.name)

  return rows
}

export type CreateProductInput = {
  title: string
  description?: string | null
  price: string
  currency: "USD" | "MMK"
  categoryId?: string | null
  condition?: string | null
  location?: string | null
  sellerId: string
  imageUrls?: string[]
}

export async function createProductInDb(input: CreateProductInput): Promise<string> {
  const [inserted] = await db
    .insert(product)
    .values({
      title: input.title,
      description: input.description ?? null,
      price: input.price,
      currency: input.currency,
      categoryId: input.categoryId ?? null,
      condition: input.condition ?? null,
      location: input.location ?? null,
      sellerId: input.sellerId,
    })
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
  description?: string | null
  price?: string
  currency?: "USD" | "MMK"
  categoryId?: string | null
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
  if (rest.description !== undefined) updates.description = rest.description
  if (rest.price !== undefined) updates.price = rest.price
  if (rest.currency !== undefined) updates.currency = rest.currency
  if (rest.categoryId !== undefined) updates.categoryId = rest.categoryId
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
