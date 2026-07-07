"use server"

import { revalidateProductsCache } from "@/features/products/db/cache/products"
import { canAdminManageProducts, canVerifyProducts } from "@/features/products/permissions/products"
import {
  productCreateSchema,
  productUpdateSchema,
  productDeleteSchema,
} from "@/features/products/schemas/products"
import {
  createProductInDb,
  updateProductInDb,
  deleteProductInDb,
  verifyProductInDb,
  unverifyProductInDb,
} from "@/features/products/db/products"
import { db } from "@/drizzle/db"
import { product } from "@/drizzle/schema/product-schema"
import { user } from "@/drizzle/schema/auth-schema"
import { and, eq, gte, inArray, sql } from "drizzle-orm"
import { deductUserPoints } from "@/features/points/db/points"
import { emptyToNull, zodErrorMessage } from "@/lib/form-data"
import { requireActionRole } from "@/lib/action-guard"
import { getColorById } from "@/features/colors/db/color"
import { searchUsersForPicker, getRecentUsersForPicker, getUsersPaginatedFromDb } from "@/features/users/db/users"
import type { UserPickerOption } from "@/features/users/db/users"
import { getCompanySettings } from "@/features/company-settings/db/company-settings"

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

function featuredExpiresAtFromForm(fd: FormData): string | null {
  const raw = fd.get("featuredExpiresAt")
  if (raw === null) return null
  const s = String(raw).trim()
  return s === "" ? null : s
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
    pieceCount: emptyToNull(formData.get("pieceCount")),
    weightCarat: emptyToNull(formData.get("weightCarat")),
    dimensions: emptyToNull(formData.get("dimensions")),
    color: emptyToNull(formData.get("color")),
    colorId: emptyToNull(formData.get("colorId")),
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
    isVerified: formData.get("isVerified") === "on" || formData.get("isVerified") === "true",
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

  let resolvedColor = parsed.data.color ?? null
  if (parsed.data.colorId) {
    const colorRow = await getColorById(parsed.data.colorId)
    if (!colorRow) {
      return { error: "Unknown colorId" }
    }
    resolvedColor = colorRow.name
  }

  const canApplyVerified =
    canVerifyProducts(session.user.role) && parsed.data.moderationStatus === "approved"
  const isVerifiedOnCreate = canApplyVerified && (parsed.data.isVerified ?? false)

  const isOwnProduct = formData.get("isOwnProduct") === "true" || formData.get("isOwnProduct") === "on"
  let effectiveSellerId: string
  if (isOwnProduct) {
    const companySettings = await getCompanySettings()
    effectiveSellerId = companySettings?.companyUserId ?? session.user.id
  } else {
    effectiveSellerId = (String(formData.get("sellerId") ?? "").trim() || null) ?? session.user.id
  }

  if (!isOwnProduct && (parsed.data.isFeatured ?? false) && (parsed.data.featured ?? 0) > 0) {
    const deduction = await deductUserPoints(effectiveSellerId, parsed.data.featured ?? 0)
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
    pieceCount: parsed.data.pieceCount,
    weightCarat: parsed.data.weightCarat,
    dimensions: parsed.data.dimensions,
    color: resolvedColor,
    colorId: parsed.data.colorId ?? null,
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
    isVerified: isVerifiedOnCreate,
    verifiedBy: isVerifiedOnCreate ? session.user.id : null,
    imageUrls: parsed.data.imageUrls,
    videoUrls: parsed.data.videoUrls,
    sellerId: effectiveSellerId,
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
    color: emptyToNull(formData.get("color")), // ignored unless colorId resolves — the form has no product-level color input
    colorId: emptyToNull(formData.get("colorId")),
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
    featuredExpiresAt: featuredExpiresAtFromForm(formData),
    isCollectorPiece: formData.get("isCollectorPiece") === "on" || formData.get("isCollectorPiece") === "true",
    isPrivilegeAssist: formData.get("isPrivilegeAssist") === "on" || formData.get("isPrivilegeAssist") === "true",
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

  // Jewellery forms never render the colour select, so `colorId` is absent from FormData
  // entirely (not merely empty) — distinguish that from "select rendered but cleared" so we
  // don't overwrite an existing colour with null on every jewellery-product edit.
  const colorFieldRendered = formData.has("colorId")

  let resolvedColor: string | null = null
  if (parsed.data.colorId) {
    const colorRow = await getColorById(parsed.data.colorId)
    if (!colorRow) {
      return { error: "Unknown colorId" }
    }
    resolvedColor = colorRow.name
  }

  const isOwnProductUpdate = formData.get("isOwnProduct") === "on" || formData.get("isOwnProduct") === "true"
  let newSellerId: string | undefined
  if (isOwnProductUpdate) {
    const companySettings = await getCompanySettings()
    newSellerId = companySettings?.companyUserId ?? undefined
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
    const safe = Math.max(0, Math.floor(additionalPointsNeeded))
    const ok = await db.transaction(async (tx) => {
      const [deducted] = await tx
        .update(user)
        .set({ points: sql`${user.points} - ${safe}` })
        .where(and(eq(user.id, currentRow.sellerId), gte(user.points, safe)))
        .returning({ id: user.id })
      if (!deducted) return false
      // Set featured flag atomically with the deduction so neither can succeed without the other.
      // updateProductInDb below will write the same values again via its own transaction (idempotent).
      await tx.update(product)
        .set({ isFeatured: true, featured: nextPoints })
        .where(eq(product.id, productId))
      return true
    })
    if (!ok) return { error: "Insufficient points balance" }
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
      pieceCount: data.pieceCount,
      weightCarat: data.weightCarat,
      dimensions: data.dimensions,
      color: colorFieldRendered ? (data.colorId ? resolvedColor : null) : undefined,
      colorId: colorFieldRendered ? (data.colorId ?? null) : undefined,
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
      featuredExpiresAt: data.featuredExpiresAt,
      isCollectorPiece: data.isCollectorPiece,
      isPrivilegeAssist: data.isPrivilegeAssist,
      imageUrls: data.imageUrls,
      videoUrls: data.videoUrls,
      sellerId: newSellerId,
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
  status: "draft" | "pending" | "active" | "archive" | "sold"
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

export async function searchSellersAction(query: string): Promise<UserPickerOption[]> {
  const session = await requireActionRole(canAdminManageProducts)
  if (!session) return []
  return searchUsersForPicker(query, 8)
}

export async function getRecentSellersAction(): Promise<UserPickerOption[]> {
  const session = await requireActionRole(canAdminManageProducts)
  if (!session) return []
  return getRecentUsersForPicker(5)
}

export async function searchSellersPagedAction(
  query: string,
  page: number
): Promise<{ users: UserPickerOption[]; total: number }> {
  const session = await requireActionRole(canAdminManageProducts)
  if (!session) return { users: [], total: 0 }
  const { users, total } = await getUsersPaginatedFromDb({
    page,
    limit: 20,
    search: query || undefined,
  })
  return {
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone ?? null,
      points: u.points,
      role: u.role,
    })),
    total,
  }
}

export async function verifyProductAction(
  productId: string,
  isVerified: boolean
): Promise<{ success: true } | { error: string }> {
  const session = await requireActionRole(canVerifyProducts)
  if (!session) return { error: "Unauthorized" }

  const [p] = await db
    .select({ moderationStatus: product.moderationStatus })
    .from(product)
    .where(eq(product.id, productId))

  if (!p) return { error: "Product not found" }

  if (isVerified && p.moderationStatus !== "approved") {
    return { error: "Product must be approved before verifying" }
  }

  if (isVerified) {
    await verifyProductInDb(productId, session.user.id)
  } else {
    await unverifyProductInDb(productId, session.user.id)
  }

  revalidateProductsCache(productId)
  return { success: true }
}
