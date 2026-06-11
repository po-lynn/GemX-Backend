"use server"

import { revalidateProductsCache } from "@/features/products/db/cache/products"
import { canAdminManageProducts } from "@/features/products/permissions/products"
import {
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
import { eq, inArray } from "drizzle-orm"
import { deductUserPoints } from "@/features/points/db/points"
import { emptyToNull, zodErrorMessage } from "@/lib/form-data"
import { requireActionRole } from "@/lib/action-guard"

/** FormData: missing → undefined (skip on update); empty → clear; else trimmed string */
function promotionComparePriceFromForm(fd: FormData): string | null | undefined {
  const raw = fd.get("promotionComparePrice")
  if (raw === null) return undefined
  const s = String(raw).trim()
  if (s === "") return null
  return s
}

function featuredPointsFromForm(fd: FormData): number | undefined {
  const raw = fd.get("featured")
  if (raw === null) return undefined
  const s = String(raw).trim()
  if (s === "") return undefined
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return undefined
  return Math.floor(n)
}

function featureDurationDaysFromForm(fd: FormData): number | undefined {
  const raw = fd.get("featureDurationDays")
  if (raw === null) return undefined
  const s = String(raw).trim()
  if (s === "") return undefined
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return undefined
  return Math.min(365, Math.max(0, Math.floor(n)))
}

export async function createProductAction(formData: FormData) {
  const parsed = productCreateSchema.safeParse({
    title: formData.get("title"),
    sku: emptyToNull(formData.get("sku")),
    description: emptyToNull(formData.get("description")),
    identification: emptyToNull(formData.get("identification")),
    price: formData.get("price"),
    currency: formData.get("currency") || "USD",
    isNegotiable: formData.get("isNegotiable") === "on" || formData.get("isNegotiable") === "true",
    productType: formData.get("productType") === "jewellery" ? "jewellery" : "loose_stone",
    categoryId: emptyToNull(formData.get("categoryId")),
    stoneCut: emptyToNull(formData.get("stoneCut")) as "Faceted" | "Cabochon" | null | undefined,
    metal: emptyToNull(formData.get("metal")) as "Gold" | "Silver" | "Other" | null | undefined,
    jewelleryGemstones: formData.get("jewelleryGemstones")?.toString() || undefined,
    totalWeightGrams: emptyToNull(formData.get("totalWeightGrams")),
    weightCarat: emptyToNull(formData.get("weightCarat")),
    dimensions: emptyToNull(formData.get("dimensions")),
    color: emptyToNull(formData.get("color")),
    shape: emptyToNull(formData.get("shape")),
    origin: emptyToNull(formData.get("origin")),
    laboratoryId: emptyToNull(formData.get("laboratoryId")),
    certReportNumber: emptyToNull(formData.get("certReportNumber")),
    certReportDate: emptyToNull(formData.get("certReportDate")),
    certReportUrl: emptyToNull(formData.get("certReportUrl")),
    additionalMemos: emptyToNull(formData.get("additionalMemos")),
    status: formData.get("status") || undefined,
    moderationStatus: formData.get("moderationStatus") || undefined,
    isFeatured: formData.get("isFeatured") === "on" || formData.get("isFeatured") === "true",
    featured: featuredPointsFromForm(formData),
    featureDurationDays: featureDurationDaysFromForm(formData),
    isCollectorPiece: formData.get("isCollectorPiece") === "on" || formData.get("isCollectorPiece") === "true",
    isPrivilegeAssist: formData.get("isPrivilegeAssist") === "on" || formData.get("isPrivilegeAssist") === "true",
    isPromotion: formData.get("isPromotion") === "on" || formData.get("isPromotion") === "true",
    promotionComparePrice: promotionComparePriceFromForm(formData),
    imageUrls: formData.get("imageUrls") || undefined,
    videoUrls: formData.get("videoUrls") || undefined,
  })
  if (!parsed.success) {
    const msg = zodErrorMessage(parsed.error)
    return { error: msg }
  }

  const session = await requireActionRole(canAdminManageProducts)
  if (!session) {
    return { error: "Unauthorized" }
  }

  if ((parsed.data.isFeatured ?? false) && (parsed.data.featured ?? 0) > 0) {
    const deduction = await deductUserPoints(session.user.id, parsed.data.featured ?? 0)
    if (!deduction.success) {
      return { error: "Insufficient points balance" }
    }
  }

  const productId = await createProductInDb({
    title: parsed.data.title,
    sku: parsed.data.sku,
    description: parsed.data.description,
    identification: parsed.data.identification,
    price: parsed.data.price,
    currency: parsed.data.currency,
    isNegotiable: parsed.data.isNegotiable,
    productType: parsed.data.productType,
    categoryId: parsed.data.categoryId,
    stoneCut: parsed.data.stoneCut,
    metal: parsed.data.metal,
    jewelleryGemstones: parsed.data.jewelleryGemstones,
    totalWeightGrams: parsed.data.totalWeightGrams,
    weightCarat: parsed.data.weightCarat,
    dimensions: parsed.data.dimensions,
    color: parsed.data.color,
    shape: parsed.data.shape,
    origin: parsed.data.origin,
    laboratoryId: parsed.data.laboratoryId,
    certReportNumber: parsed.data.certReportNumber,
    certReportDate: parsed.data.certReportDate,
    certReportUrl: parsed.data.certReportUrl,
    additionalMemos: parsed.data.additionalMemos,
    status: parsed.data.status,
    moderationStatus: parsed.data.moderationStatus,
    isFeatured: parsed.data.isFeatured,
    featured: parsed.data.featured,
    featureDurationDays: parsed.data.featureDurationDays,
    isCollectorPiece: parsed.data.isCollectorPiece,
    isPrivilegeAssist: parsed.data.isPrivilegeAssist,
    isPromotion: parsed.data.isPromotion,
    promotionComparePrice: parsed.data.promotionComparePrice ?? null,
    imageUrls: parsed.data.imageUrls,
    videoUrls: parsed.data.videoUrls,
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
    identification: emptyToNull(formData.get("identification")),
    price: (() => {
      const v = formData.get("price")
      return v === "" ? undefined : v
    })(),
    currency: formData.get("currency") || undefined,
    isNegotiable: formData.get("isNegotiable") === "on" || formData.get("isNegotiable") === "true",
    productType: formData.get("productType") === "jewellery" ? "jewellery" : "loose_stone",
    categoryId: emptyToNull(formData.get("categoryId")),
    stoneCut: emptyToNull(formData.get("stoneCut")) as "Faceted" | "Cabochon" | null | undefined,
    metal: emptyToNull(formData.get("metal")) as "Gold" | "Silver" | "Other" | null | undefined,
    jewelleryGemstones: formData.get("jewelleryGemstones")?.toString() || undefined,
    totalWeightGrams: emptyToNull(formData.get("totalWeightGrams")),
    weightCarat: emptyToNull(formData.get("weightCarat")),
    dimensions: emptyToNull(formData.get("dimensions")),
    color: emptyToNull(formData.get("color")),
    shape: emptyToNull(formData.get("shape")),
    origin: emptyToNull(formData.get("origin")),
    laboratoryId: emptyToNull(formData.get("laboratoryId")),
    certReportNumber: emptyToNull(formData.get("certReportNumber")),
    certReportDate: emptyToNull(formData.get("certReportDate")),
    certReportUrl: emptyToNull(formData.get("certReportUrl")),
    additionalMemos: emptyToNull(formData.get("additionalMemos")),
    status: formData.get("status") || undefined,
    moderationStatus: formData.get("moderationStatus") || undefined,
    isFeatured: formData.get("isFeatured") === "on" || formData.get("isFeatured") === "true",
    featured: featuredPointsFromForm(formData),
    featureDurationDays: featureDurationDaysFromForm(formData),
    isCollectorPiece: formData.get("isCollectorPiece") === "on" || formData.get("isCollectorPiece") === "true",
    isPrivilegeAssist: formData.get("isPrivilegeAssist") === "on" || formData.get("isPrivilegeAssist") === "true",
    isPromotion: formData.get("isPromotion") === "on" || formData.get("isPromotion") === "true",
    promotionComparePrice: promotionComparePriceFromForm(formData),
    imageUrls: formData.get("imageUrls") || undefined,
    videoUrls: formData.get("videoUrls") || undefined,
  })
  if (!parsed.success) {
    const msg = zodErrorMessage(parsed.error)
    return { error: msg }
  }

  const session = await requireActionRole(canAdminManageProducts)
  if (!session) {
    return { error: "Unauthorized" }
  }

  const { productId, ...data } = parsed.data
  const [currentRow] = await db
    .select({
      sellerId: product.sellerId,
      isFeatured: product.isFeatured,
      featured: product.featured,
      featuredDurationDays: product.featuredDurationDays,
      featuredExpiresAt: product.featuredExpiresAt,
    })
    .from(product)
    .where(eq(product.id, productId))
    .limit(1)
  if (!currentRow) return { error: "Product not found" }

  const previousPoints = currentRow.isFeatured ? currentRow.featured : 0
  const nextPoints = data.isFeatured === true ? Math.max(0, data.featured ?? previousPoints) : 0
  const additionalPointsNeeded = Math.max(0, nextPoints - previousPoints)
  if (additionalPointsNeeded > 0) {
    const deduction = await deductUserPoints(currentRow.sellerId, additionalPointsNeeded)
    if (!deduction.success) {
      return { error: "Insufficient points balance" }
    }
  }

  await updateProductInDb(
    productId,
    {
      title: data.title,
      sku: data.sku,
      description: data.description,
      identification: data.identification,
      price: data.price,
      currency: data.currency,
      isNegotiable: data.isNegotiable,
      productType: data.productType,
      categoryId: data.categoryId,
      stoneCut: data.stoneCut,
      metal: data.metal,
      jewelleryGemstones: data.jewelleryGemstones,
      totalWeightGrams: data.totalWeightGrams,
      weightCarat: data.weightCarat,
      dimensions: data.dimensions,
      color: data.color,
      shape: data.shape,
      origin: data.origin,
      laboratoryId: data.laboratoryId,
      certReportNumber: data.certReportNumber,
      certReportDate: data.certReportDate,
      certReportUrl: data.certReportUrl,
      additionalMemos: data.additionalMemos,
      status: data.status,
      moderationStatus: data.moderationStatus,
      isFeatured: data.isFeatured,
      featured: data.featured,
      featureDurationDays: data.featureDurationDays,
      isCollectorPiece: data.isCollectorPiece,
      isPrivilegeAssist: data.isPrivilegeAssist,
      isPromotion: data.isPromotion,
      promotionComparePrice: data.promotionComparePrice,
      imageUrls: data.imageUrls,
      videoUrls: data.videoUrls,
    },
    { actorId: session.user.id }
  )

  revalidateProductsCache(productId)
  return { success: true, productId }
}

export async function deleteProductAction(formData: FormData) {
  const parsed = productDeleteSchema.safeParse({
    productId: formData.get("productId"),
  })
  if (!parsed.success) return { error: "Invalid input" }

  const session = await requireActionRole(canAdminManageProducts)
  if (!session) {
    return { error: "Unauthorized" }
  }

  const deleted = await deleteProductInDb(parsed.data.productId)
  if (!deleted) return { error: "Product not found" }

  revalidateProductsCache(parsed.data.productId)
  return { success: true }
}

export async function bulkSetProductModeration(
  ids: string[],
  moderationStatus: "pending" | "approved" | "rejected"
) {
  if (!ids.length) return { error: "No products selected" }

  const session = await requireActionRole(canAdminManageProducts)
  if (!session) {
    return { error: "Unauthorized" }
  }

  await db.update(product).set({ moderationStatus }).where(inArray(product.id, ids))
  revalidateProductsCache()
  return { success: true, count: ids.length }
}

export async function bulkSetProductStatus(
  ids: string[],
  status: "pending" | "active" | "archive" | "sold" | "hidden"
) {
  if (!ids.length) return { error: "No products selected" }

  const session = await requireActionRole(canAdminManageProducts)
  if (!session) {
    return { error: "Unauthorized" }
  }

  await db.update(product).set({ status }).where(inArray(product.id, ids))
  revalidateProductsCache()
  return { success: true, count: ids.length }
}
