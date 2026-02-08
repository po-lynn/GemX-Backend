"use server"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidateProductsCache } from "@/features/products/db/cache/products"
import { canAdminManageProducts } from "@/features/products/permissions/products"
import {
  productModerationActionSchema,
  productStatusActionSchema,
  productFeaturedActionSchema,
  productCreateSchema,
  productUpdateSchema,
  productDeleteSchema,
} from "@/features/products/schemas/products"
import {
  createProductInDb,
  updateProductInDb,
  deleteProductInDb,
} from "@/features/products/db/products"
import { db } from "@/drizzle/db"
import { product } from "@/drizzle/schema/product-schema"
import { eq } from "drizzle-orm"

export async function setProductModeration(formData: FormData) {
  const parsed = productModerationActionSchema.safeParse({
    productId: formData.get("productId"),
    moderationStatus: formData.get("moderationStatus"),
  })
  if (!parsed.success) return { error: "Invalid input" }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !canAdminManageProducts(session.user.role)) {
    return { error: "Unauthorized" }
  }

  await db
    .update(product)
    .set({ moderationStatus: parsed.data.moderationStatus })
    .where(eq(product.id, parsed.data.productId))

  revalidateProductsCache(parsed.data.productId)
  return { success: true }
}

export async function setProductStatus(formData: FormData) {
  const parsed = productStatusActionSchema.safeParse({
    productId: formData.get("productId"),
    status: formData.get("status"),
  })
  if (!parsed.success) return { error: "Invalid input" }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !canAdminManageProducts(session.user.role)) {
    return { error: "Unauthorized" }
  }

  await db
    .update(product)
    .set({ status: parsed.data.status })
    .where(eq(product.id, parsed.data.productId))

  revalidateProductsCache(parsed.data.productId)
  return { success: true }
}

export async function setProductFeatured(formData: FormData) {
  const parsed = productFeaturedActionSchema.safeParse({
    productId: formData.get("productId"),
    featured: Number(formData.get("featured")),
  })
  if (!parsed.success) return { error: "Invalid input" }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !canAdminManageProducts(session.user.role)) {
    return { error: "Unauthorized" }
  }

  await db
    .update(product)
    .set({ featured: parsed.data.featured })
    .where(eq(product.id, parsed.data.productId))

  revalidateProductsCache(parsed.data.productId)
  return { success: true }
}

function emptyToNull<T>(v: T): T | null | undefined {
  return v === "" ? null : (v ?? undefined)
}

export async function createProductAction(formData: FormData) {
  const parsed = productCreateSchema.safeParse({
    title: formData.get("title"),
    sku: emptyToNull(formData.get("sku")),
    description: emptyToNull(formData.get("description")),
    price: formData.get("price"),
    currency: formData.get("currency") || "USD",
    isNegotiable: formData.get("isNegotiable") === "on" || formData.get("isNegotiable") === "true",
    categoryId: emptyToNull(formData.get("categoryId")),
    speciesId: emptyToNull(formData.get("speciesId")),
    weightCarat: emptyToNull(formData.get("weightCarat")),
    dimensions: emptyToNull(formData.get("dimensions")),
    color: emptyToNull(formData.get("color")),
    shape: emptyToNull(formData.get("shape")),
    treatment: emptyToNull(formData.get("treatment")),
    origin: emptyToNull(formData.get("origin")),
    certLabName: emptyToNull(formData.get("certLabName")),
    certReportNumber: emptyToNull(formData.get("certReportNumber")),
    certReportUrl: emptyToNull(formData.get("certReportUrl")),
    condition: emptyToNull(formData.get("condition")),
    location: emptyToNull(formData.get("location")),
    imageUrls: formData.get("imageUrls") || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" }
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !canAdminManageProducts(session.user.role)) {
    return { error: "Unauthorized" }
  }

  const productId = await createProductInDb({
    title: parsed.data.title,
    sku: parsed.data.sku,
    description: parsed.data.description,
    price: parsed.data.price,
    currency: parsed.data.currency,
    isNegotiable: parsed.data.isNegotiable,
    categoryId: parsed.data.categoryId,
    speciesId: parsed.data.speciesId,
    weightCarat: parsed.data.weightCarat,
    dimensions: parsed.data.dimensions,
    color: parsed.data.color,
    shape: parsed.data.shape,
    treatment: parsed.data.treatment,
    origin: parsed.data.origin,
    certLabName: parsed.data.certLabName,
    certReportNumber: parsed.data.certReportNumber,
    certReportUrl: parsed.data.certReportUrl,
    condition: parsed.data.condition,
    location: parsed.data.location,
    imageUrls: parsed.data.imageUrls,
    sellerId: session.user.id,
  })

  revalidateProductsCache(productId)
  return { success: true, productId }
}

export async function updateProductAction(formData: FormData) {
  const parsed = productUpdateSchema.safeParse({
    productId: formData.get("productId"),
    title: formData.get("title") || undefined,
    sku: emptyToNull(formData.get("sku")),
    description: emptyToNull(formData.get("description")),
    price: (() => {
      const v = formData.get("price")
      return v === "" ? undefined : v
    })(),
    currency: formData.get("currency") || undefined,
    isNegotiable: formData.get("isNegotiable") === "on" || formData.get("isNegotiable") === "true",
    categoryId: emptyToNull(formData.get("categoryId")),
    speciesId: emptyToNull(formData.get("speciesId")),
    weightCarat: emptyToNull(formData.get("weightCarat")),
    dimensions: emptyToNull(formData.get("dimensions")),
    color: emptyToNull(formData.get("color")),
    shape: emptyToNull(formData.get("shape")),
    treatment: emptyToNull(formData.get("treatment")),
    origin: emptyToNull(formData.get("origin")),
    certLabName: emptyToNull(formData.get("certLabName")),
    certReportNumber: emptyToNull(formData.get("certReportNumber")),
    certReportUrl: emptyToNull(formData.get("certReportUrl")),
    condition: emptyToNull(formData.get("condition")),
    location: emptyToNull(formData.get("location")),
    imageUrls: formData.get("imageUrls") || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" }
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !canAdminManageProducts(session.user.role)) {
    return { error: "Unauthorized" }
  }

  const { productId, ...data } = parsed.data
  await updateProductInDb(productId, {
    title: data.title,
    sku: data.sku,
    description: data.description,
    price: data.price,
    currency: data.currency,
    isNegotiable: data.isNegotiable,
    categoryId: data.categoryId,
    speciesId: data.speciesId,
    weightCarat: data.weightCarat,
    dimensions: data.dimensions,
    color: data.color,
    shape: data.shape,
    treatment: data.treatment,
    origin: data.origin,
    certLabName: data.certLabName,
    certReportNumber: data.certReportNumber,
    certReportUrl: data.certReportUrl,
    condition: data.condition,
    location: data.location,
    imageUrls: data.imageUrls,
  })

  revalidateProductsCache(productId)
  return { success: true, productId }
}

export async function deleteProductAction(formData: FormData) {
  const parsed = productDeleteSchema.safeParse({
    productId: formData.get("productId"),
  })
  if (!parsed.success) return { error: "Invalid input" }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !canAdminManageProducts(session.user.role)) {
    return { error: "Unauthorized" }
  }

  const deleted = await deleteProductInDb(parsed.data.productId)
  if (!deleted) return { error: "Product not found" }

  revalidateProductsCache(parsed.data.productId)
  return { success: true }
}
